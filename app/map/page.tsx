'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, MapPinned } from 'lucide-react';
import {
  assessListing,
  assessListingWithRules,
  mapOfficialListingRow,
  type DashboardProfile,
  type OfficialListing,
  type StoredEligibilityRule,
} from '@/domain/dashboard';
import { useAuth } from '@/features/auth/auth-context';
import { useUserPreferences } from '@/features/user-data/use-user-preferences';
import { getSupabaseClient } from '@/lib/supabase/client';

const ListingMapProvider = lazy(() => import('./listing-map-provider').then((module) => ({ default: module.ListingMapProvider })));

export default function ListingMapPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [listings, setListings] = useState<OfficialListing[]>([]);
  const [agency, setAgency] = useState('');
  const [region, setRegion] = useState('');
  const [program, setProgram] = useState('');
  const [possibleOnly, setPossibleOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [mapAreaOnly, setMapAreaOnly] = useState(false);
  const [mapAreaListingIds, setMapAreaListingIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [rulesByListing, setRulesByListing] = useState<Record<string, StoredEligibilityRule[]>>({});
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const { savedListingIds, toggleSavedListing } = useUserPreferences(user?.id);
  const toggleSavedListingRef = useRef(toggleSavedListing);
  useEffect(() => { toggleSavedListingRef.current = toggleSavedListing; }, [toggleSavedListing]);

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    const client = getSupabaseClient();
    if (!client) { setError('공고 서버에 연결할 수 없습니다.'); return; }
    void client.from('official_listings').select('*').in('status', ['공고중', '정정공고중', '접수중']).order('published_at', { ascending: false }).then(({ data, error: listingError }) => {
      if (listingError) setError('공고 위치를 불러오지 못했습니다.');
      else setListings((data ?? []).map(mapOfficialListingRow));
    });
    void client.from('profiles').select('birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,is_married,has_children,child_count,marriage_date,expected_marriage_date,spouse_has_income,youngest_child_birth_date,is_pregnant,graduation_date,receives_livelihood_benefit,receives_housing_benefit,is_near_poverty,is_supported_single_parent,subscription_payment_count,residence_start_date,profile_completed_at').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setProfile(data as DashboardProfile);
    });
    void client.from('listing_eligibility_rules').select('source_listing_id,rule_key,operator,numeric_value,text_value,description,confidence').then(({ data }) => {
      if (!data) return;
      const groupedRules: Record<string, StoredEligibilityRule[]> = {};
      for (const rule of data) (groupedRules[rule.source_listing_id] ??= []).push(rule);
      setRulesByListing(groupedRules);
    });
  }, [user]);

  const assessmentByListing = useMemo(() => Object.fromEntries(listings.map((listing) => {
    if (!profile) return [listing.id, '진단 확인 필요'];
    const rules = rulesByListing[listing.id] ?? [];
    const assessment = rules.length ? assessListingWithRules(profile, listing, rules) : assessListing(profile, listing);
    return [listing.id, assessment.status];
  })), [listings, profile, rulesByListing]);
  const filteredListings = useMemo(() => listings.filter((listing) => {
    if (agency && listing.agency !== agency) return false;
    if (region && listing.region !== region) return false;
    if (program && listing.program !== program) return false;
    return !possibleOnly || assessmentByListing[listing.id] === '가능성 있음';
  }), [listings, agency, region, program, possibleOnly, assessmentByListing]);
  const mapListings = useMemo(() => savedOnly ? filteredListings.filter((listing) => savedListingIds.includes(listing.id)) : filteredListings, [filteredListings, savedOnly, savedListingIds]);
  const visible = useMemo(() => mapAreaOnly ? mapListings.filter((listing) => mapAreaListingIds.includes(listing.id)) : mapListings, [mapListings, mapAreaOnly, mapAreaListingIds]);
  const mapMetadata = useMemo(() => Object.fromEntries(mapListings.map((listing) => [listing.id, { assessmentStatus: assessmentByListing[listing.id] ?? '진단 확인 필요', saved: savedListingIds.includes(listing.id) }])), [mapListings, assessmentByListing, savedListingIds]);
  const openListing = useCallback((listingId: string) => {
    router.push(`/listings/view?id=${encodeURIComponent(listingId)}`);
  }, [router]);
  const saveListing = useCallback((listingId: string) => { void toggleSavedListingRef.current(listingId).then(() => setActionMessage('관심 공고 상태를 변경했습니다.')).catch(() => setActionMessage('관심 공고 상태를 변경하지 못했습니다.')); }, []);
  const updateMapAreaListings = useCallback((listingIds: string[]) => setMapAreaListingIds(listingIds), []);
  const openListingCard = useCallback((event: React.MouseEvent<HTMLElement>, listingId: string) => {
    if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea, label')) return;
    openListing(listingId);
  }, [openListing]);
  const openListingCardWithKeyboard = useCallback((event: React.KeyboardEvent<HTMLElement>, listingId: string) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openListing(listingId);
  }, [openListing]);

  if (loading || !user) return <main className="grid min-h-screen place-items-center"><p>공고 지도를 불러오고 있습니다…</p></main>;
  return <main className="min-h-screen bg-background px-8 py-9 text-foreground"><div className="mx-auto max-w-6xl space-y-6">
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft className="size-4" />홈으로</Link>
    <div><div className="flex items-center gap-2"><MapPinned className="size-7 text-primary" /><h1 className="text-3xl font-black">공고 지도 보기</h1></div><p className="mt-2 text-sm text-muted-foreground">진행 중인 LH·SH·HUG 공고 위치를 확인할 수 있습니다. 마커를 누른 다음 공고 제목을 선택하면 상세 페이지로 이동합니다.</p></div>
    <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 md:items-end"><label className="flex flex-col gap-1 text-sm">기관<select className="h-10 rounded border px-3" value={agency} onChange={(event) => setAgency(event.target.value)}><option value="">전체 기관</option><option>LH</option><option>SH</option><option>HUG</option></select></label><label className="flex flex-col gap-1 text-sm">지역<select className="h-10 rounded border px-3" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">전체 지역</option>{[...new Set(listings.map((listing) => listing.region))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label className="flex flex-col gap-1 text-sm">공고 유형<select className="h-10 rounded border px-3" value={program} onChange={(event) => setProgram(event.target.value)}><option value="">전체 유형</option>{[...new Set(listings.map((listing) => listing.program))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm"><input type="checkbox" checked={possibleOnly} disabled={!profile} onChange={(event) => setPossibleOnly(event.target.checked)} />내가 지원할 수 있는 공고만</label><label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} />관심 공고만</label><button type="button" className={`h-10 rounded-lg border px-3 text-sm font-bold ${mapAreaOnly ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setMapAreaOnly((current) => !current)}>{mapAreaOnly ? '지도 영역 검색 해제' : '현재 지도 영역에서 재검색'}</button></div>
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">{error}</p>}
    {actionMessage && <output className="block rounded-xl border bg-white p-3 text-sm">{actionMessage}</output>}
    {!error && <Suspense fallback={<div className="grid h-[62vh] min-h-[480px] place-items-center rounded-2xl border bg-white"><p>지도를 불러오고 있습니다…</p></div>}><ListingMapProvider listings={mapListings} focusedRegion={region} metadata={mapMetadata} onListingSelect={openListing} onToggleSaved={saveListing} onVisibleListingIdsChange={updateMapAreaListings} /></Suspense>}
    {!error && visible.length > 0 && <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">표시 중인 공고</h2><span className="text-sm font-bold text-primary">{visible.length}건</span></div><div className="grid gap-3 md:grid-cols-2">{visible.map((listing) => <article key={listing.id} role="link" tabIndex={0} onClick={(event) => openListingCard(event, listing.id)} onKeyDown={(event) => openListingCardWithKeyboard(event, listing.id)} className="cursor-pointer rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"><span className="text-xs font-black text-primary">{listing.agency} · {listing.region} · {listing.program}</span><Link href={`/listings/view?id=${encodeURIComponent(listing.id)}`} className="mt-1 block font-extrabold hover:underline">{listing.title}</Link><p className="mt-2 text-sm text-muted-foreground">{listing.address ?? '상세 주소는 공식 원문에서 확인해 주세요.'}</p><div className="mt-3 flex flex-wrap gap-2">{listing.address && <><a href={`https://map.naver.com/p/search/${encodeURIComponent(listing.address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold">네이버지도<ArrowUpRight className="size-3" /></a><a href={`https://map.kakao.com/link/search/${encodeURIComponent(listing.address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold">카카오맵<ArrowUpRight className="size-3" /></a></>}</div></article>)}</div></section>}
    {!error && visible.length === 0 && <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">선택한 조건에 표시할 공고가 없습니다.</p>}
  </div></main>;
}
