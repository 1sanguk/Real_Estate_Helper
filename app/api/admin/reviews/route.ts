import { NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/supabase/server-auth';

const allowedStatuses = ['pending', 'approved', 'needs_correction'];

export async function PUT(request: Request) {
  const authenticated = await authenticateAdminRequest(request);
  if (!authenticated)
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const body = (await request.json()) as {
    sourceListingId?: string;
    reviewStatus?: string;
    reviewNote?: string;
  };
  if (!body.sourceListingId || !body.reviewStatus || !allowedStatuses.includes(body.reviewStatus))
    return NextResponse.json({ error: '검수 정보를 확인해 주세요.' }, { status: 400 });

  const { error } = await authenticated.client.from('listing_reviews').upsert({
    source_listing_id: body.sourceListingId,
    review_status: body.reviewStatus,
    review_note: body.reviewNote?.trim() || null,
    reviewer_id: authenticated.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error)
    return NextResponse.json({ error: '검수 결과를 저장하지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
