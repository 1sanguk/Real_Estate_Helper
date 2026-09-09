import { createClient } from '@supabase/supabase-js';
import { assessListingWithRules, mapOfficialListingRow, type DashboardProfile, type StoredEligibilityRule } from '../domain/dashboard.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const [{ data: profiles, error: profileError }, { data: listingRows, error: listingError }, { data: rules, error: ruleError }] = await Promise.all([
  db.from('profiles').select('user_id,birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,is_married,has_children,child_count,marriage_date,expected_marriage_date,spouse_has_income,youngest_child_birth_date,is_pregnant,graduation_date,receives_livelihood_benefit,receives_housing_benefit,is_near_poverty,is_supported_single_parent,subscription_payment_count,residence_start_date,profile_completed_at').not('profile_completed_at', 'is', null),
  db.from('official_listings').select('*').in('status', ['공고중', '정정공고중', '접수중']),
  db.from('listing_eligibility_rules').select('source_listing_id,rule_key,operator,numeric_value,text_value,description,confidence'),
]);
if (profileError) throw profileError;
if (listingError) throw listingError;
if (ruleError) throw ruleError;
const grouped: Record<string, StoredEligibilityRule[]> = {};
for (const rule of rules ?? []) (grouped[rule.source_listing_id] ??= []).push(rule);
const listings = (listingRows ?? []).map(mapOfficialListingRow);
const now = new Date().toISOString();
const matches = (profiles ?? []).flatMap((profile) => listings.map((listing) => {
  const result = assessListingWithRules(profile as DashboardProfile, listing, grouped[listing.id] ?? []);
  return { user_id: profile.user_id, source_listing_id: listing.id, match_status: result.status, reason: result.reason, calculated_at: now };
}));
for (let index = 0; index < matches.length; index += 1000) {
  const { error } = await db.from('user_listing_matches').upsert(matches.slice(index, index + 1000), { onConflict: 'user_id,source_listing_id' });
  if (error) throw error;
}

const [{ data: preferences }, { data: savedListings }, { data: inactiveListings }] = await Promise.all([
  db.from('notification_preferences').select('user_id,new_match_enabled,deadline_enabled,deadline_days'),
  db.from('saved_listings').select('user_id,source_listing_id'),
  db.from('official_listings').select('source_listing_id').not('status', 'in', '(공고중,정정공고중,접수중)'),
]);
const preferenceByUser = new Map((preferences ?? []).map((item) => [item.user_id, item]));
const listingById = new Map(listings.map((listing) => [listing.id, listing]));
const notifications = matches
  .filter((match) => match.match_status === '가능성 있음' && (preferenceByUser.get(match.user_id)?.new_match_enabled ?? true))
  .map((match) => ({
    user_id: match.user_id,
    source_listing_id: match.source_listing_id,
    kind: 'new_match',
    title: '새로운 지원 가능 공고',
    message: listingById.get(match.source_listing_id)?.title ?? '내 조건과 맞는 공고가 등록되었습니다.',
  }));

function parseApplicationEnd(period: string | undefined) {
  if (!period) return null;
  const matches = period.match(/\d{4}[-.]?\d{2}[-.]?\d{2}/g);
  const value = matches?.at(-1)?.replace(/\./g, '-');
  if (!value) return null;
  const date = new Date(`${value}T23:59:59+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

for (const saved of savedListings ?? []) {
  const preference = preferenceByUser.get(saved.user_id);
  if (preference?.deadline_enabled === false) continue;
  const listing = listingById.get(saved.source_listing_id);
  const deadline = parseApplicationEnd(listing?.applicationPeriod);
  if (!listing || !deadline) continue;
  const remainingDays = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
  const deadlineDays = preference?.deadline_days ?? 3;
  if (remainingDays < 0 || remainingDays > deadlineDays) continue;
  notifications.push({
    user_id: saved.user_id,
    source_listing_id: saved.source_listing_id,
    kind: 'deadline',
    title: '관심 공고 접수 마감 임박',
    message: `${listing.title} 공고가 ${remainingDays === 0 ? '오늘' : `${remainingDays}일 후`} 마감됩니다.`,
  });
}

for (let index = 0; index < notifications.length; index += 1000) {
  const { error } = await db.from('user_notifications').upsert(notifications.slice(index, index + 1000), {
    onConflict: 'user_id,source_listing_id,kind',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

const inactiveIds = (inactiveListings ?? []).map((item) => item.source_listing_id);
for (let index = 0; index < inactiveIds.length; index += 500) {
  const { error } = await db.from('user_listing_matches').delete().in('source_listing_id', inactiveIds.slice(index, index + 500));
  if (error) throw error;
}
console.log(`사용자별 판정 재계산 완료: ${matches.length}건`);
