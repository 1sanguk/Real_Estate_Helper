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
  officialListings,
  profileCompletion,
  assessListing,
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

export default function HomePage() {
  const router = useRouter();
  const { loading, user, signOut } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [listings, setListings] = useState<OfficialListing[]>(officialListings);
  const [storedMatches, setStoredMatches] = useState<
    Record<string, { status: string; tone: 'success' | 'warning' | 'danger'; reason: string }>
  >({});
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
    void Promise.all([
      client.from('official_listings').select('*').order('published_at', { ascending: false }),
      client.from('user_listing_matches').select('source_listing_id,match_status,reason').eq('user_id', user.id),
    ]).then(([listingResult, matchResult]) => {
      if (!listingResult.error && listingResult.data?.length) {
        setListings(listingResult.data.map((row) => ({
          id: row.source_listing_id,
          agency: row.agency,
          title: row.title,
          program: row.program,
          region: row.region,
          address: row.address ?? undefined,
          area: row.area ?? undefined,
          units: row.units ?? undefined,
          publishedAt: row.published_at ?? '',
          applicationPeriod: row.application_period ?? undefined,
          status: row.status,
          minimumAge: row.minimum_age ?? undefined,
          sourceUrl: row.source_url,
        })));
      }
      if (!matchResult.error && matchResult.data) {
        setStoredMatches(Object.fromEntries(matchResult.data.map((row) => [row.source_listing_id, {
          status: row.match_status,
          tone: row.match_status === '가능성 있음' ? 'success' : row.match_status === '어려움' ? 'danger' : 'warning',
          reason: row.reason,
        }])));
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
            assessment: storedMatches[listing.id] ?? assessListing(profile, listing),
          }))
        : [],
    [profile, listings, storedMatches],
  );
  const possibleCount = assessed.filter(
    (item) => item.assessment.status === '가능성 있음',
  ).length;

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
            <Link href="/profile/setup">내 조건 수정</Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
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
              공식 출처 확인 · 2026.09.07
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
                내 조건으로 확인한 실제 공고
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                합성 데이터는 모두 제거했습니다. 자격은 공식 원문 확인 전까지
                사전 진단으로 표시합니다.
              </p>
            </div>
            <strong className="text-sm text-primary">
              총 {assessed.length}건
            </strong>
          </div>
          <div className="space-y-3">
            {assessed.map(({ listing, assessment }) => (
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
                    <h3 className="text-lg font-extrabold">{listing.title}</h3>
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
                        onClick={() => void toggleSavedListing(listing.id)}
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
