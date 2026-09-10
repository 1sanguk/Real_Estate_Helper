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
import { HugApiClient } from '../infrastructure/hug/hug-api.ts';
import { runListingChangeWorkflow } from '../application/listing-change-workflow.ts';
import { preserveKnownListingDetails, type ComparableListing } from '../domain/listing-changes.ts';

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
  const status = String(row.PAN_SS ?? row.PAN_SS_NM ?? row.panSs ?? '');
  return ['공고중', '정정공고중', '접수중'].includes(status);
}

async function main() {
  const supabase = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: run, error: runError } = await supabase.from('listing_sync_runs').insert({ status: 'running' }).select('id').single();
  if (runError) throw runError;
  try {
    const lhClient = new LhApiClient({
      serviceKey: publicServiceKey(),
      announcementUrl: process.env.LH_ANNOUNCEMENT_API_URL,
      supplyUrl: process.env.LH_SUPPLY_API_URL,
      detailUrl: process.env.LH_SUPPLY_DETAIL_API_URL,
    });
    const announcementRows = await lhClient.fetchAnnouncements();
    const activeAnnouncements = announcementRows.filter(isActiveAnnouncement);
    const supplyRows = await lhClient.fetchSupplies(activeAnnouncements);
    const details = await lhClient.fetchDetails(activeAnnouncements);
    const listings = mapLhApiResponse(announcementRows, supplyRows);
    const hugClient = process.env.HUG_LISTINGS_API_URL
      ? new HugApiClient(process.env.HUG_LISTINGS_API_URL, publicServiceKey())
      : null;
    const hugResult = hugClient ? await hugClient.fetchListings() : { listings: [], rowsById: new Map<string, LhApiRow[]>() };
    const allListings = [...listings, ...hugResult.listings];
    if (!listings.length) throw new Error('공식 API에서 유효한 공고를 찾지 못해 기존 데이터를 보존했습니다.');
    const rawById = new Map(announcementRows.map((row) => [getListingId(row), row]));
    const collectedRows = allListings.map((item) => toDatabaseRow(item, rawById.get(item.id) ?? { items: hugResult.rowsById.get(item.id) ?? [] }));
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
    if (details.length) {
      const syncedAt = new Date().toISOString();
      const detailRows = details.map((detail) => ({
        source_listing_id: detail.panId,
        application_schedules: detail.schedules,
        complexes: detail.complexes,
        contract_places: detail.contractPlaces,
        raw_data: detail.rawData,
        synced_at: syncedAt,
      }));
      const { error: detailError } = await supabase.from('listing_details')
        .upsert(detailRows, { onConflict: 'source_listing_id' });
      if (detailError) throw detailError;
      const attachmentRows = details.flatMap((detail) => detail.attachments.map((item) => ({
        source_listing_id: detail.panId,
        name: String(item.CMN_AHFL_NM ?? '첨부파일'),
        document_type: String(item.SL_PAN_AHFL_DS_CD_NM ?? '기타'),
        source_url: String(item.AHFL_URL ?? ''),
        synced_at: syncedAt,
      }))).filter((item) => item.source_url);
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
    console.log(`동기화 완료: 공고 ${allListings.length}건, 사용자별 판정 ${matches.length}건`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('listing_sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 1000) }).eq('id', run.id);
    const { data: admins } = await supabase.from('admin_users').select('user_id');
    if (admins?.length) await supabase.from('user_notifications').insert(admins.map((admin) => ({
      user_id: admin.user_id,
      source_listing_id: null,
      kind: 'sync_failed',
      title: '공고 자동 동기화 실패',
      message: `공고 수집이 완료되지 않았습니다: ${message.slice(0, 300)}`,
    })));
    throw error;
  }
}

await main();
