'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Heart,
  Home,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  calculateAge,
  profileCompletion,
  assessListing,
  mapOfficialListingRow,
  type DashboardProfile,
  type OfficialListing,
} from '@/domain/dashboard';
import { useAuth } from '@/features/auth/auth-context';
import { useUserPreferences } from '@/features/user-data/use-user-preferences';
import { getSupabaseClient } from '@/lib/supabase/client';

const officialSources = [
  {
    name: 'LH 청약플러스',
    url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026',
  },
  { name: 'SH 인터넷청약', url: 'https://www.i-sh.co.kr/app' },
  {
    name: 'HUG 든든전세',
    url: 'https://www.khug.or.kr/jeonse/web/s07/s070101.jsp',
  },
];

export default function HomePage() { return <Dashboard />; }

export function Dashboard({ savedOnly = false }: { savedOnly?: boolean }) {
  const router = useRouter();
  const { loading, user, signOut } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [listings, setListings] = useState<OfficialListing[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [possibleOnly, setPossibleOnly] = useState(false);
  const [listingError, setListingError] = useState('');
  const [listingsLoading, setListingsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState('');
  const { savedListingIds, toggleSavedListing } = useUserPreferences(user?.id);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    const client = getSupabaseClient();
    if (!client) {
      setProfileError('프로필 서버에 연결할 수 없습니다.');
      return;
    }
    void client
      .from('profiles')
      .select(
        'birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,profile_completed_at',
      )
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setProfileError('저장된 프로필을 불러오지 못했습니다.');
          return;
        }
        if (!data.profile_completed_at) {
          router.replace('/profile/setup');
          return;
        }
        setProfile(data as DashboardProfile);
      });
    void client.from('official_listings').select('*').order('published_at', { ascending: false }).then((listingResult) => {
      setListingsLoading(false);
      if (listingResult.error) setListingError('공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      if (!listingResult.error && listingResult.data) {
        setListings(listingResult.data.map(mapOfficialListingRow));
      }
    });
  }, [user, router]);

  const age = calculateAge(profile?.birth_date ?? null);
  const completion = profile
    ? profileCompletion(profile)
    : { percent: 0, missing: [] };
  const assessed = useMemo(
    () =>
      profile
        ? listings.map((listing) => ({
            listing,
            assessment: assessListing(profile, listing),
          }))
        : [],
    [profile, listings],
  );
  const possibleCount = assessed.filter(
    (item) => item.assessment.status === '가능성 있음',
  ).length;
  const visible = assessed.filter(({listing, assessment}) =>
    (!savedOnly || savedListingIds.includes(listing.id)) &&
    (!region || listing.region === region) &&
    (!possibleOnly || assessment.status === '가능성 있음') &&
    `${listing.title} ${listing.region} ${listing.address ?? ''} ${listing.program}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  async function saveListing(id: string) {
    if (pendingId) return;
    setPendingId(id);
    try {
      const saved = savedListingIds.includes(id);
      if (!await toggleSavedListing(id)) throw new Error();
      setActionMessage(saved ? '관심 공고에서 해제했습니다.' : '관심 공고에 저장했습니다.');
    } catch { setActionMessage('관심 공고 저장에 실패했습니다. 다시 시도해 주세요.'); }
    finally { setPendingId(null); }
  }

  if (loading || !user || (!profile && !profileError))
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm font-semibold text-muted-foreground">
          내 조건과 공식 공고를 확인하고 있어요…
        </p>
      </main>
    );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
              <Home className="size-5" />
            </span>
            <strong className="text-lg">내집레이더</strong>
          </Link>
          <nav className="flex items-center gap-7 text-sm font-bold">
            <a href="#listings">실제 공고</a>
            <Link href="/saved">관심 공고</Link>
            <Link href="/profile/setup">내 조건 수정</Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut().catch(() => setActionMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.'))}
            >
              <LogOut className="size-4" />
              로그아웃
            </Button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-7 px-8 py-9">
        {profileError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
          >
            {profileError}
          </p>
        )}
        <section className="grid gap-6 lg:grid-cols-[1.5fr_.8fr]">
          <a
            href="#listings"
            className="hero-panel relative flex min-h-72 flex-col justify-center overflow-hidden rounded-[28px] p-9 text-white"
          >
            <span className="mb-4 w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
              수집된 공식 공고 기준
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-.045em]">
              현재 확인된 실제 임대 공고{' '}
              <span className="text-[#9be5cb]">
                {listings.length}건
              </span>
            </h1>
            <p className="mt-3 text-white/70">
              내 조건 기준 가능성 있음 {possibleCount}건 · 목록을 보려면
              클릭하세요.
            </p>
          </a>
          <section className="rounded-[28px] border bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-extrabold">내 자격 프로필</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  저장된 내 정보에서 실시간 계산
                </p>
              </div>
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-sm font-bold">
                <span>프로필 완성도</span>
                <span className="text-primary">{completion.percent}%</span>
              </div>
              <Progress value={completion.percent} />
              {completion.missing.length > 0 ? (
                <div className="mt-3 rounded-xl bg-[#fff8e6] p-3 text-xs leading-5 text-[#725a16]">
                  <strong>추가 입력 필요:</strong>{' '}
                  {completion.missing.join(', ')}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
                  <CheckCircle2 className="size-4" />
                  필수 조건을 모두 입력했습니다.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ProfileDatum
                icon={<UserRound />}
                label="만 나이"
                value={age === null ? '미입력' : `만 ${age}세`}
              />
              <ProfileDatum
                icon={<WalletCards />}
                label="월평균 소득"
                value={
                  profile?.monthly_income == null
                    ? '미입력'
                    : `${profile.monthly_income.toLocaleString()}만원`
                }
              />
              <ProfileDatum
                icon={<Home />}
                label="주택 여부"
                value={profile?.is_homeless ? '무주택' : '주택 보유'}
              />
              <ProfileDatum
                icon={<MapPin />}
                label="거주 지역"
                value={profile?.residence_region ?? '미입력'}
              />
            </div>
            <Link
              href="/profile/setup"
              className="mt-4 flex h-11 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-primary"
            >
              부족한 정보 입력 및 수정
            </Link>
          </section>
        </section>

        <section id="listings" className="scroll-mt-24">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="section-kicker">VERIFIED OFFICIAL LISTINGS</p>
              <h2 className="text-2xl font-black tracking-[-.04em]">
                {savedOnly ? '내 관심 공고' : '내 조건으로 확인한 실제 공고'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                합성 데이터는 모두 제거했습니다. 자격은 공식 원문 확인 전까지
                사전 진단으로 표시합니다.
              </p>
            </div>
            <strong className="text-sm text-primary">
              검색 결과 {visible.length}건
            </strong>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4">
            <label className="flex flex-col gap-1 text-sm">공고 검색<input className="rounded border p-2" placeholder="공고명, 지역, 주소, 사업 유형" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label className="flex flex-col gap-1 text-sm">지역<select className="rounded border p-2" value={region} onChange={event => setRegion(event.target.value)}><option value="">전체 지역</option>{[...new Set(listings.map(item => item.region))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={possibleOnly} onChange={event => setPossibleOnly(event.target.checked)} />가능성 있는 공고만</label>
            <Button variant="outline" onClick={() => { setQuery(''); setRegion(''); setPossibleOnly(false); }}>검색 초기화</Button>
          </div>
          {actionMessage && <p role="status" className="mb-4 rounded border p-3">{actionMessage}</p>}
          {listingError && <p role="alert" className="mb-4 text-destructive">{listingError} <button onClick={() => window.location.reload()}>다시 시도</button></p>}
          {listingsLoading ? <p className="p-6">공고를 불러오고 있습니다…</p> : !listingError && visible.length === 0 && <p className="rounded-xl border p-6">{listings.length === 0 ? '아직 수집된 공고가 없습니다. 공식 공고가 수집되면 여기에 표시됩니다.' : savedOnly ? '조건에 맞는 관심 공고가 없습니다. 홈에서 공고를 저장하거나 검색 조건을 변경해 주세요.' : '검색 조건에 맞는 공고가 없습니다. 검색 조건을 변경해 주세요.'}</p>}
          <div className="space-y-3">
            {visible.map(({ listing, assessment }) => (
              <article
                key={listing.id}
                className="rounded-2xl border bg-white p-6"
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-center">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md bg-[#eaf2ff] px-2 py-1 text-xs font-black text-[#315fa8]">
                        {listing.agency}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {listing.program} · {listing.status} · 공고일{' '}
                        {listing.publishedAt}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold">
                      <Link href={`/listings/${encodeURIComponent(listing.id)}`} className="hover:underline">
                        {listing.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {listing.region}
                      {listing.address ? ` · ${listing.address}` : ''}
                      {listing.area ? ` · ${listing.area}` : ''}
                      {listing.units ? ` · ${listing.units}` : ''}
                    </p>
                    {listing.applicationPeriod && (
                      <p className="mt-2 text-sm font-bold">
                        접수기간 {listing.applicationPeriod}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-secondary/70 p-4">
                    <span
                      className={`text-sm font-black ${assessment.tone === 'success' ? 'text-primary' : assessment.tone === 'danger' ? 'text-destructive' : 'text-[#8a6512]'}`}
                    >
                      {assessment.status}
                    </span>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {assessment.reason}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingId !== null}
                        onClick={() => void saveListing(listing.id)}
                      >
                        <Heart
                          className="size-4"
                          fill={
                            savedListingIds.includes(listing.id)
                              ? 'currentColor'
                              : 'none'
                          }
                        />
                        {savedListingIds.includes(listing.id)
                          ? '저장됨'
                          : '관심 저장'}
                      </Button>
                      <Link
                        href={`/listings/${encodeURIComponent(listing.id)}`}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold"
                      >
                        상세·서류 보기
                      </Link>
                      <a
                        href={listing.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-white"
                      >
                        공식 원문
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <CircleAlert className="size-5 text-[#a27413]" />
              <h2 className="font-extrabold">자격 판정 범위</h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              현재는 거주 지역, 무주택 여부, 연령 같은 명확한 조건으로 1차
              판정합니다. 공고별 가구원 소득 기준, 자산 기준, 거주 우선순위와
              공급형별 세부 조건은 첨부 공고문 분석이 완료되어야 최종 판정할 수
              있습니다.
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              <h2 className="font-extrabold">공식 공고 출처</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {officialSources.map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border px-3 py-2 text-sm font-bold hover:bg-secondary"
                >
                  {source.name}
                  <ArrowUpRight className="ml-1 inline size-4" />
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileDatum({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="mb-2 text-primary [&>svg]:size-4">{icon}</div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
