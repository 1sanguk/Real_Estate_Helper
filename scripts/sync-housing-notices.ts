import { createClient } from '@supabase/supabase-js';
import {
  assessListing,
  isActiveListingStatus,
  mapLhApiResponse,
  type DashboardProfile,
  type LhApiRow,
  type OfficialListing,
} from '../domain/dashboard.ts';
import { getListingId, LhApiClient } from '../infrastructure/lh/lh-api.ts';
import { DEFAULT_HUG_LISTINGS_URL, HugApiClient } from '../infrastructure/hug/hug-api.ts';
import { DEFAULT_SH_RSS_URL, ShApiClient } from '../infrastructure/sh/sh-api.ts';
import { runListingChangeWorkflow } from '../application/listing-change-workflow.ts';
import { preserveKnownListingDetails, type ComparableListing } from '../domain/listing-changes.ts';
import { applicationPeriodFromSchedules } from '../domain/listing-schedule.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

function publicServiceKey() {
  const value = process.env.PUBLIC_SERVICE_KEY?.trim() || process.env.LH_SUPPLY_SERVICE_KEY?.trim();
  if (!value) throw new Error('PUBLIC_SERVICE_KEY 환경 변수가 필요합니다.');
  return value;
}

function sourceText(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function toDatabaseRow(listing: OfficialListing, rawData: LhApiRow) {
  return {
    source_listing_id: listing.id, agency: listing.agency, title: listing.title,
    program: listing.program, region: listing.region, address: listing.address ?? null,
    area: listing.area ?? null, units: listing.units ?? null,
    published_at: listing.publishedAt || null, application_period: listing.applicationPeriod ?? null,
    status: listing.status, minimum_age: listing.minimumAge ?? null,
    source_url: listing.sourceUrl, raw_data: rawData, synced_at: new Date().toISOString(),
  };
}

function isActiveAnnouncement(row: LhApiRow): boolean {
  const status = sourceText(row.PAN_SS ?? row.PAN_SS_NM ?? row.panSs);
  return ['공고중', '정정공고중', '접수중'].includes(status);
}

async function main() {
  const supabase = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: run, error: runError } = await supabase.from('listing_sync_runs').insert({ status: 'running' }).select('id').single();
  if (runError) throw runError;
  try {
    let announcementRows: LhApiRow[] = [];
    let listings: OfficialListing[] = [];
    let details: Awaited<ReturnType<LhApiClient['fetchDetails']>> = [];
    try {
      const lhClient = new LhApiClient({
        serviceKey: publicServiceKey(),
        announcementUrl: process.env.LH_ANNOUNCEMENT_API_URL,
        supplyUrl: process.env.LH_SUPPLY_API_URL,
        detailUrl: process.env.LH_SUPPLY_DETAIL_API_URL,
        allowHttpFallback: process.env.LH_ALLOW_HTTP_FALLBACK === 'true',
      });
      announcementRows = await lhClient.fetchAnnouncements();
      const activeAnnouncements = announcementRows.filter(isActiveAnnouncement);
      const supplyRows = await lhClient.fetchSupplies(activeAnnouncements);
      details = await lhClient.fetchDetails(activeAnnouncements);
      listings = mapLhApiResponse(announcementRows, supplyRows);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`LH 공고 수집 실패로 다른 기관 공고를 계속 처리합니다: ${reason}`);
    }
    const hugClient = new HugApiClient(
      process.env.HUG_LISTINGS_API_URL?.trim() || DEFAULT_HUG_LISTINGS_URL,
      publicServiceKey(),
    );
    const hugResult = await hugClient.fetchListings().catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`HUG 공고 수집 실패로 LH 공고만 계속 처리합니다: ${reason}`);
      return { listings: [], details: [], rowsById: new Map<string, LhApiRow[]>() };
    });
    const shClient = new ShApiClient(
      process.env.SH_ANNOUNCEMENT_RSS_URL?.trim() || DEFAULT_SH_RSS_URL,
    );
    const shResult = await shClient.fetchListings().catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`SH 공고 수집 실패로 다른 기관 공고를 계속 처리합니다: ${reason}`);
      return {
        listings: [],
        details: [],
        rowsById: new Map<string, LhApiRow>(),
      };
    });
    const detailById = new Map(details.map((detail) => [detail.panId, detail]));
    const allListings = [...listings, ...hugResult.listings, ...shResult.listings].map((listing) => ({
      ...listing,
      applicationPeriod: listing.applicationPeriod
        ?? applicationPeriodFromSchedules(detailById.get(listing.id)?.schedules ?? [])
        ?? undefined,
    }));
    if (!allListings.length) throw new Error('공식 출처에서 유효한 공고를 찾지 못해 기존 데이터를 보존했습니다.');
    const rawById = new Map(announcementRows.map((row) => [getListingId(row), row]));
    for (const [id, row] of shResult.rowsById) rawById.set(id, row);
    const collectedRows = allListings.map((item) => toDatabaseRow(
      item,
      rawById.get(item.id) ?? { items: hugResult.rowsById.get(item.id) ?? [] },
    ));
    const { data: existingRows, error: existingError } = await supabase.from('official_listings')
      .select('source_listing_id,title,program,region,address,area,units,published_at,application_period,status,minimum_age,source_url');
    if (existingError) throw existingError;
    const incomingRows = preserveKnownListingDetails(
      collectedRows as ComparableListing[],
      (existingRows ?? []) as ComparableListing[],
    );
    const changeWorkflow = await runListingChangeWorkflow(
      (existingRows ?? []) as ComparableListing[],
      incomingRows as ComparableListing[],
    );
    const { error: listingError } = await supabase.from('official_listings')
      .upsert(incomingRows, { onConflict: 'source_listing_id' });
    if (listingError) throw listingError;
    if (changeWorkflow.changes.length) {
      const { error: changeError } = await supabase.from('listing_change_events').upsert(
        changeWorkflow.changes.map((change) => ({
          source_listing_id: change.sourceListingId,
          fingerprint: change.fingerprint,
          changed_fields: change.changes,
          summary: change.summary,
        })),
        { onConflict: 'source_listing_id,fingerprint', ignoreDuplicates: true },
      );
      if (changeError) throw changeError;

      const { data: savedRows, error: savedError } = await supabase.from('saved_listings')
        .select('user_id,source_listing_id')
        .in('source_listing_id', changeWorkflow.changedListingIds);
      if (savedError) throw savedError;
      const userIds = [...new Set((savedRows ?? []).map((row) => row.user_id))];
      const { data: preferences, error: preferenceError } = userIds.length
        ? await supabase.from('notification_preferences').select('user_id,listing_change_enabled').in('user_id', userIds)
        : { data: [], error: null };
      if (preferenceError) throw preferenceError;
      const disabledUsers = new Set((preferences ?? []).filter((preference) => !preference.listing_change_enabled).map((preference) => preference.user_id));
      const changeById = new Map(changeWorkflow.changes.map((change) => [change.sourceListingId, change]));
      const notifications = (savedRows ?? []).filter((row) => !disabledUsers.has(row.user_id)).flatMap((row) => {
        const change = changeById.get(row.source_listing_id);
        return change ? [{
          user_id: row.user_id,
          source_listing_id: row.source_listing_id,
          kind: 'listing_changed',
          title: '관심 공고의 내용이 변경됐습니다',
          message: change.summary.slice(0, 900),
          read_at: null,
          created_at: new Date().toISOString(),
        }] : [];
      });
      if (notifications.length) {
        const { error: notificationError } = await supabase.from('user_notifications')
          .upsert(notifications, { onConflict: 'user_id,source_listing_id,kind' });
        if (notificationError) throw notificationError;
      }
    }
    if (details.length || shResult.details.length || hugResult.details.length) {
      const syncedAt = new Date().toISOString();
      const detailRows = details.map((detail) => ({
        source_listing_id: detail.panId,
        application_schedules: detail.schedules,
        complexes: detail.complexes,
        contract_places: detail.contractPlaces,
        raw_data: detail.rawData,
        synced_at: syncedAt,
      })).concat(shResult.details.map((detail) => ({
        source_listing_id: detail.sourceListingId,
        application_schedules: detail.applicationPeriod
          ? [{ applicationPeriod: detail.applicationPeriod }]
          : [],
        complexes: [],
        contract_places: [],
        raw_data: detail.rawData,
        synced_at: syncedAt,
      }))).concat(hugResult.details.map((detail) => ({
        source_listing_id: detail.sourceListingId,
        application_schedules: [{ applicationPeriod: detail.applicationPeriod }],
        complexes: [],
        contract_places: [],
        raw_data: detail.rawData,
        synced_at: syncedAt,
      })));
      const { error: detailError } = await supabase.from('listing_details')
        .upsert(detailRows, { onConflict: 'source_listing_id' });
      if (detailError) throw detailError;
      const attachmentRows = details.flatMap((detail) => detail.attachments.map((item) => ({
        source_listing_id: detail.panId,
        name: sourceText(item.CMN_AHFL_NM, '첨부파일'),
        document_type: sourceText(item.SL_PAN_AHFL_DS_CD_NM, '기타'),
        source_url: sourceText(item.AHFL_URL),
        synced_at: syncedAt,
      }))).concat(shResult.details.flatMap((detail) => detail.attachments.map((item) => ({
        source_listing_id: detail.sourceListingId,
        name: item.name,
        document_type: item.documentType,
        source_url: item.sourceUrl,
        synced_at: syncedAt,
      })))).concat(hugResult.details.flatMap((detail) => detail.attachments.map((item) => ({
        source_listing_id: detail.sourceListingId,
        name: item.name,
        document_type: item.documentType,
        source_url: item.sourceUrl,
        synced_at: syncedAt,
      })))).filter((item) => item.source_url);
      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase.from('listing_attachments')
          .upsert(attachmentRows, { onConflict: 'source_listing_id,source_url' });
        if (attachmentError) throw attachmentError;
      }
    }

    const { data: profiles, error: profileError } = await supabase.from('profiles').select(
      'user_id,birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,is_married,has_children,child_count,marriage_date,expected_marriage_date,spouse_has_income,youngest_child_birth_date,is_pregnant,graduation_date,receives_livelihood_benefit,receives_housing_benefit,is_near_poverty,is_supported_single_parent,subscription_payment_count,residence_start_date,profile_completed_at',
    ).not('profile_completed_at', 'is', null);
    if (profileError) throw profileError;
    const activeListings = allListings.filter((listing) => isActiveListingStatus(listing.status));
    const matches = (profiles ?? []).flatMap((profile) => activeListings.map((listing) => {
      const result = assessListing(profile as DashboardProfile, listing);
      return { user_id: profile.user_id, source_listing_id: listing.id, match_status: result.status, reason: result.reason, calculated_at: new Date().toISOString() };
    }));
    for (let index = 0; index < matches.length; index += 1000) {
      const { error } = await supabase.from('user_listing_matches').upsert(matches.slice(index, index + 1000), { onConflict: 'user_id,source_listing_id' });
      if (error) throw error;
    }
    await supabase.from('listing_sync_runs').update({ status: 'succeeded', completed_at: new Date().toISOString(), listing_count: allListings.length, match_count: matches.length }).eq('id', run.id);
    console.log(
      `동기화 완료: 공고 ${allListings.length}건(LH ${listings.length}건, SH ${shResult.listings.length}건, HUG ${hugResult.listings.length}건), 사용자별 판정 ${matches.length}건`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('listing_sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 1000) }).eq('id', run.id);
    if (process.env.NOTIFY_SYNC_FAILURE !== 'false') {
      const { data: admins } = await supabase.from('admin_users').select('user_id');
      if (admins?.length) await supabase.from('user_notifications').insert(admins.map((admin) => ({
        user_id: admin.user_id,
        source_listing_id: null,
        kind: 'sync_failed',
        title: '공고 자동 동기화 실패',
        message: `공고 수집이 완료되지 않았습니다: ${message.slice(0, 300)}`,
      })));
    }
    throw error;
  }
}

await main();
