'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '@/features/auth/auth-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client) return setError('재설정 메일 서버에 연결할 수 없습니다.');
    setLoading(true);
    setError('');
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (resetError) {
      if (resetError.code === 'over_email_send_rate_limit') return setError('현재 테스트 메일 발송 한도를 초과했습니다. 약 1시간 후 다시 시도해 주세요.');
      if (resetError.code === 'email_address_not_authorized') return setError('현재 테스트 서버에서 발송이 허용되지 않은 이메일입니다. Supabase 팀 이메일을 사용하거나 SMTP 설정이 필요합니다.');
      return setError('재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setSent(true);
  }

  if (sent) return <AuthShell title="메일 전송 완료" description="입력하신 이메일의 받은편지함을 확인해 주세요.">
    <div className="space-y-6 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-7" /></div>
      <p role="status" className="font-bold text-foreground">재설정 메일을 보내드렸습니다.</p>
      <Link href="/login" className={buttonVariants({ className: 'h-11 w-full rounded-xl' })}>로그인으로 돌아가기</Link>
    </div>
  </AuthShell>;

  return <AuthShell title="비밀번호 재설정" description="회원가입 때 입력한 이메일로 재설정 링크를 보내드려요." footer={<Link href="/login" className="font-bold text-primary">로그인으로 돌아가기</Link>}>
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>
      {error&&<p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>{loading ? '전송 중…' : '재설정 메일 보내기'}</Button>
    </form>
  </AuthShell>;
}
