import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

type LoginLimit = {
  failed_count: number;
  first_failed_at: string;
  blocked_until: string | null;
} | null;

async function hashLoginIdentity(username: string, request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const bytes = new TextEncoder().encode(`${username.toLowerCase()}|${ip.trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

async function recordFailedLogin(admin: NonNullable<ReturnType<typeof createServerSupabaseClient>>, identityHash: string, limit: LoginLimit) {
  const now = new Date();
  const firstFailedAt = limit?.first_failed_at ? new Date(limit.first_failed_at) : now;
  const withinWindow = now.getTime() - firstFailedAt.getTime() < BLOCK_MINUTES * 60_000;
  const failedCount = withinWindow ? (limit?.failed_count ?? 0) + 1 : 1;
  const blockedUntil = failedCount >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + BLOCK_MINUTES * 60_000).toISOString() : null;
  await admin.from('login_rate_limits').upsert({
    identity_hash: identityHash,
    failed_count: failedCount,
    first_failed_at: withinWindow ? firstFailedAt.toISOString() : now.toISOString(),
    blocked_until: blockedUntil,
    updated_at: now.toISOString(),
  });
  return blockedUntil;
}

export async function POST(request: Request) {
  const { username, password } = await request.json() as { username?: string; password?: string };
  if (!username || !password) return NextResponse.json({ error: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
  const admin = createServerSupabaseClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!admin || !url || !publishableKey) return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 });
  const identityHash = await hashLoginIdentity(username.trim(), request);
  const { data: limit } = await admin.from('login_rate_limits').select('failed_count,first_failed_at,blocked_until').eq('identity_hash', identityHash).maybeSingle();
  if (limit?.blocked_until && new Date(limit.blocked_until) > new Date())
    return NextResponse.json({ error: '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.' }, { status: 429 });
  const { data: profile } = await admin.from('profiles').select('email').ilike('username', username.trim()).maybeSingle();
  if (!profile?.email) {
    const blockedUntil = await recordFailedLogin(admin, identityHash, limit);
    return NextResponse.json({ error: blockedUntil ? '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.' : '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: blockedUntil ? 429 : 401 });
  }
  const authClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email: profile.email, password });
  if (error || !data.session) {
    const blockedUntil = await recordFailedLogin(admin, identityHash, limit);
    return NextResponse.json({ error: blockedUntil ? '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.' : '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: blockedUntil ? 429 : 401 });
  }
  await admin.from('login_rate_limits').delete().eq('identity_hash', identityHash);
  return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
}
