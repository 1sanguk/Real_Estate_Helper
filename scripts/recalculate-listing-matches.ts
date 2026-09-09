import { createClient } from '@supabase/supabase-js';
import { assessListingWithRules, mapOfficialListingRow, type DashboardProfile, type StoredEligibilityRule } from '../domain/dashboard.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const [{ data: profiles, error: profileError }, { data: listingRows, error: listingError }, { data: rules, error: ruleError }] = await Promise.all([
  db.from('profiles').select('user_id,birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,profile_completed_at').not('profile_completed_at', 'is', null),
  db.from('official_listings').select('*').in('status', ['공고중', '정정공고중', '접수중']),
  db.from('listing_eligibility_rules').select('source_listing_id,rule_key,operator,numeric_value,text_value,description'),
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
console.log(`사용자별 판정 재계산 완료: ${matches.length}건`);
