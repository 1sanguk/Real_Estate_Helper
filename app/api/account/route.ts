import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/server-auth';

export async function DELETE(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { error } = await authenticated.client.auth.admin.deleteUser(
    authenticated.user.id,
  );
  if (error)
    return NextResponse.json(
      { error: '계정을 삭제하지 못했습니다.' },
      { status: 500 },
    );
  return NextResponse.json({ success: true });
}
