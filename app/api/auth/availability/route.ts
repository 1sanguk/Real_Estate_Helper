import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const client = createServerSupabaseClient();
  if (!client) return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 });
  const url = new URL(request.url);
  const field = url.searchParams.get('field');
  const value = url.searchParams.get('value')?.trim();
  if (!value || (field !== 'username' && field !== 'nickname')) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  const { data, error } = await client.from('profiles').select('user_id').ilike(field, value).limit(1);
  if (error) return NextResponse.json({ error: '중복 확인에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ available: data.length === 0 });
}

