import { createClient } from '@supabase/supabase-js';
import {
  assessListing,
  mapLhApiResponse,
  type DashboardProfile,
  type LhApiRow,
  type OfficialListing,
} from '../domain/dashboard.ts';
import { getListingId, LhApiClient } from '../infrastructure/lh/lh-api.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
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
      serviceKey: required('LH_SUPPLY_SERVICE_KEY'),
      announcementUrl: process.env.LH_ANNOUNCEMENT_API_URL,
      supplyUrl: process.env.LH_SUPPLY_API_URL,
    });
    const announcementRows = await lhClient.fetchAnnouncements();
    const supplyRows = await lhClient.fetchSupplies(announcementRows.filter(isActiveAnnouncement));
    const listings = mapLhApiResponse(announcementRows, supplyRows);
    if (!listings.length) throw new Error('공식 API에서 유효한 공고를 찾지 못해 기존 데이터를 보존했습니다.');
    const rawById = new Map(announcementRows.map((row) => [getListingId(row), row]));
    const { error: listingError } = await supabase.from('official_listings')
      .upsert(listings.map((item) => toDatabaseRow(item, rawById.get(item.id) ?? {})), { onConflict: 'source_listing_id' });
    if (listingError) throw listingError;

    const { data: profiles, error: profileError } = await supabase.from('profiles').select(
      'user_id,birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,profile_completed_at',
    ).not('profile_completed_at', 'is', null);
    if (profileError) throw profileError;
    const matches = (profiles ?? []).flatMap((profile) => listings.map((listing) => {
      const result = assessListing(profile as DashboardProfile, listing);
      return { user_id: profile.user_id, source_listing_id: listing.id, match_status: result.status, reason: result.reason, calculated_at: new Date().toISOString() };
    }));
    for (let index = 0; index < matches.length; index += 1000) {
      const { error } = await supabase.from('user_listing_matches').upsert(matches.slice(index, index + 1000), { onConflict: 'user_id,source_listing_id' });
      if (error) throw error;
    }
    await supabase.from('listing_sync_runs').update({ status: 'succeeded', completed_at: new Date().toISOString(), listing_count: listings.length, match_count: matches.length }).eq('id', run.id);
    console.log(`동기화 완료: 공고 ${listings.length}건, 사용자별 판정 ${matches.length}건`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('listing_sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 1000) }).eq('id', run.id);
    throw error;
  }
}

await main();
