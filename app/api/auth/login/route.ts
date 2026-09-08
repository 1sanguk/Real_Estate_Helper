import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { username, password } = await request.json() as { username?: string; password?: string };
  if (!username || !password) return NextResponse.json({ error: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
  const admin = createServerSupabaseClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!admin || !url || !publishableKey) return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 });
  const { data: profile } = await admin.from('profiles').select('email').ilike('username', username.trim()).maybeSingle();
  if (!profile?.email) return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  const authClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email: profile.email, password });
  if (error || !data.session) return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
}

