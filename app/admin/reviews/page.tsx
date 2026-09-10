'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';

type ReviewListing = {
  source_listing_id: string;
  title: string;
  agency: string;
  status: string;
  source_url: string;
};

export default function ListingReviewsPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [listings, setListings] = useState<ReviewListing[]>([]);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !user) return;
    void client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle().then(async ({ data }) => {
      const allowed = Boolean(data);
      setIsAdmin(allowed);
      if (!allowed) return;
      const [listingResult, reviewResult] = await Promise.all([
        client.from('official_listings').select('source_listing_id,title,agency,status,source_url').in('status', ['공고중', '정정공고중', '접수중']).order('published_at', { ascending: false }),
        client.from('listing_reviews').select('source_listing_id,review_status,review_note'),
      ]);
      if (listingResult.data) setListings(listingResult.data);
      if (reviewResult.data) {
        setReviews(Object.fromEntries(reviewResult.data.map((item) => [item.source_listing_id, item.review_status])));
        setNotes(Object.fromEntries(reviewResult.data.map((item) => [item.source_listing_id, item.review_note ?? ''])));
      }
    });
  }, [user]);

  async function saveReview(sourceListingId: string, reviewStatus: string) {
    const client = getSupabaseClient();
    if (!client || !user) return;
    const { error } = await client.from('listing_reviews').upsert({
      source_listing_id: sourceListingId,
      review_status: reviewStatus,
      review_note: notes[sourceListingId]?.trim() || null,
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setMessage('검수 결과를 저장하지 못했습니다.');
      return;
    }
    setReviews((current) => ({ ...current, [sourceListingId]: reviewStatus }));
    setMessage('검수 결과를 저장했습니다.');
  }

  if (loading || !user || isAdmin === null) return <main className="grid min-h-screen place-items-center"><p>관리자 권한을 확인하고 있습니다…</p></main>;
  if (!isAdmin) return <main className="grid min-h-screen place-items-center px-8"><div className="max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-black">관리자 전용 페이지</h1><p className="mt-2 text-sm text-muted-foreground">공고 검수 권한이 있는 계정만 접근할 수 있습니다.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">홈으로 돌아가기</Link></div></main>;

  return (
    <main className="min-h-screen bg-background px-8 py-9">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft className="size-4" />홈으로</Link>
        <div className="flex items-center gap-3"><ShieldCheck className="size-7 text-primary" /><div><h1 className="text-3xl font-black">공고 분석 검수</h1><p className="text-sm text-muted-foreground">자동 추출 결과를 공식 원문과 대조한 뒤 상태와 메모를 저장하세요.</p></div></div>
        {message && <p role="status" className="rounded-xl border bg-white p-3 text-sm font-bold">{message}</p>}
        <div className="space-y-3">
          {listings.map((listing) => <article key={listing.source_listing_id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold text-primary">{listing.agency} · {listing.status}</span><h2 className="mt-1 font-extrabold">{listing.title}</h2></div><a href={listing.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary">공식 원문</a></div><textarea value={notes[listing.source_listing_id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [listing.source_listing_id]: event.target.value }))} placeholder="검수 메모" className="mt-4 min-h-20 w-full rounded-xl border p-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><Button variant={reviews[listing.source_listing_id] === 'approved' ? 'default' : 'outline'} onClick={() => void saveReview(listing.source_listing_id, 'approved')}>검수 완료</Button><Button variant={reviews[listing.source_listing_id] === 'needs_correction' ? 'destructive' : 'outline'} onClick={() => void saveReview(listing.source_listing_id, 'needs_correction')}>수정 필요</Button><Button variant="ghost" onClick={() => void saveReview(listing.source_listing_id, 'pending')}>검수 대기</Button></div></article>)}
        </div>
      </div>
    </main>
  );
}
