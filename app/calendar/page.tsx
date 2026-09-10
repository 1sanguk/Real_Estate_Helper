'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createListingSchedule, datesInRange } from '@/domain/listing-schedule';
import { mapOfficialListingRow, type OfficialListing } from '@/domain/dashboard';
import { useAuth } from '@/features/auth/auth-context';
import { useUserPreferences } from '@/features/user-data/use-user-preferences';
import { getSupabaseClient } from '@/lib/supabase/client';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const { savedListingIds } = useUserPreferences(user?.id);
  const [listings, setListings] = useState<OfficialListing[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;
    const loadListings = async () => {
      if (!client || !user || !savedListingIds.length) {
        if (active) setListings([]);
        return;
      }
      const { data, error: listingError } = await client.from('official_listings').select('*').in('source_listing_id', savedListingIds);
      if (!active) return;
      if (listingError) setError('관심 공고 일정을 불러오지 못했습니다.');
      else {
        setError('');
        setListings((data ?? []).map(mapOfficialListingRow));
      }
    };
    void loadListings();
    return () => { active = false; };
  }, [user, savedListingIds]);

  const schedules = useMemo(() => listings.map((listing) => createListingSchedule(listing)).filter((schedule): schedule is NonNullable<typeof schedule> => schedule !== null), [listings]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof schedules>();
    for (const schedule of schedules) for (const date of datesInRange(schedule.startDate, schedule.endDate)) grouped.set(date, [...(grouped.get(date) ?? []), schedule]);
    return grouped;
  }, [schedules]);
  const calendarDays = useMemo(() => {
    const firstWeekday = month.getDay();
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: lastDay }, (_, index) => index + 1)];
  }, [month]);
  const upcoming = [...schedules].filter((schedule) => schedule.daysUntilDeadline >= 0).sort((left, right) => left.daysUntilDeadline - right.daysUntilDeadline);

  if (loading || !user) return <main className="grid min-h-screen place-items-center"><p>일정을 불러오고 있습니다…</p></main>;
  return (
    <main className="min-h-screen bg-background px-8 py-9 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />홈으로</Link>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="size-7 text-primary" /><h1 className="text-3xl font-black">지원 일정 캘린더</h1></div><p className="mt-2 text-sm text-muted-foreground">관심 공고의 접수 기간과 마감일을 한눈에 확인합니다.</p></div><Link href="/saved" className="text-sm font-bold text-primary">관심 공고 관리</Link></div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">{error}</p>}
        <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 flex items-center justify-between"><Button type="button" variant="outline" size="icon" aria-label="이전 달" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button><h2 className="text-xl font-black">{month.getFullYear()}년 {month.getMonth() + 1}월</h2><Button type="button" variant="outline" size="icon" aria-label="다음 달" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button></div>
            <div className="grid grid-cols-7 border-l border-t">{WEEKDAYS.map((weekday) => <div key={weekday} className="border-b border-r bg-secondary p-2 text-center text-xs font-bold">{weekday}</div>)}{calendarDays.map((day, index) => {
              const date = day ? isoDate(month.getFullYear(), month.getMonth(), day) : '';
              const events = day ? eventsByDate.get(date) ?? [] : [];
              return <div key={`${index}-${day}`} className="min-h-28 border-b border-r p-2"><span className={`text-xs font-bold ${index % 7 === 0 ? 'text-destructive' : ''}`}>{day}</span><div className="mt-2 space-y-1">{events.slice(0, 3).map((event) => <Link key={event.listingId} href={`/listings/view?id=${encodeURIComponent(event.listingId)}`} className="block truncate rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary" title={event.title}>{event.agency} {event.title}</Link>)}{events.length > 3 && <span className="text-[11px] text-muted-foreground">외 {events.length - 3}건</span>}</div></div>;
            })}</div>
          </div>
          <aside className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2"><Clock3 className="size-5 text-primary" /><h2 className="font-extrabold">다가오는 마감</h2></div><div className="mt-4 space-y-2">{upcoming.length ? upcoming.slice(0, 10).map((schedule) => <Link key={schedule.listingId} href={`/listings/view?id=${encodeURIComponent(schedule.listingId)}`} className="block rounded-xl border p-3 hover:bg-secondary"><div className="flex items-start justify-between gap-2"><strong className="text-sm leading-5">{schedule.title}</strong><span className="min-w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">{schedule.daysUntilDeadline === 0 ? '오늘 마감' : `D-${schedule.daysUntilDeadline}`}</span></div><p className="mt-1 text-xs text-muted-foreground">{schedule.startDate} ~ {schedule.endDate}</p></Link>) : <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">접수 일정이 확인된 관심 공고가 없습니다.</p>}</div></aside>
        </section>
      </div>
    </main>
  );
}
