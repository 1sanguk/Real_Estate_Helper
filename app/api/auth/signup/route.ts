import { NextResponse } from 'next/server';
import { validateNickname, validatePassword, validateUsername } from '@/features/auth/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const client = createServerSupabaseClient();
  if (!client) return NextResponse.json({ error: '회원가입 서버 설정이 완료되지 않았습니다.' }, { status: 503 });

  const { username, nickname, email, password } = await request.json() as Record<string, string | undefined>;
  const normalizedUsername = username?.trim().toLowerCase() ?? '';
  const normalizedNickname = nickname?.trim() ?? '';
  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  const validation = validateUsername(normalizedUsername) || validateNickname(normalizedNickname) || validatePassword(password ?? '');
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  if (!normalizedEmail) return NextResponse.json({ error: '이메일을 입력해 주세요.' }, { status: 400 });

  const { data: duplicates, error: duplicateError } = await client
    .from('profiles')
    .select('username,nickname')
    .or(`username.ilike.${normalizedUsername},nickname.ilike.${normalizedNickname}`);
  if (duplicateError) return NextResponse.json({ error: '중복 정보를 확인하지 못했습니다.' }, { status: 500 });
  if (duplicates?.some(profile => profile.username.toLowerCase() === normalizedUsername)) return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
  if (duplicates?.some(profile => profile.nickname.toLowerCase() === normalizedNickname.toLowerCase())) return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 });

  const { error } = await client.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { username: normalizedUsername, nickname: normalizedNickname },
  });
  if (error) {
    const duplicateEmail = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: duplicateEmail ? '이미 가입된 이메일입니다.' : '회원가입에 실패했습니다. 입력 정보를 확인해 주세요.' }, { status: duplicateEmail ? 409 : 400 });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
