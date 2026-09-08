'use client';

import Link from 'next/link';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '@/features/auth/auth-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-context';
import { validatePassword } from '@/features/auth/validation';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const validation = validatePassword(password);
    if (validation) return setError(validation);
    if (password !== confirmPassword) return setError('위와 아래의 비밀번호가 일치하지 않습니다.');
    if (!user?.email) return setError('재설정 링크가 만료되었거나 올바르지 않습니다. 재설정 메일을 다시 요청해 주세요.');
    const client = getSupabaseClient();
    if (!client) return setError('비밀번호 재설정 서버에 연결할 수 없습니다.');

    setSaving(true);
    try {
      const { error: samePasswordError } = await client.auth.signInWithPassword({ email: user.email, password });
      if (!samePasswordError) {
        setError('기존 비밀번호와 다른 비밀번호를 입력해 주세요.');
        return;
      }
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      await client.auth.signOut();
      setComplete(true);
    } catch {
      setError('비밀번호를 변경하지 못했습니다. 재설정 메일을 다시 요청해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <AuthShell title="새 비밀번호 설정" description="재설정 링크를 확인하고 있습니다."><div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />재설정 권한 확인 중…</div></AuthShell>;

  if (complete) return <AuthShell title="비밀번호 변경 완료" description="새 비밀번호가 안전하게 저장되었습니다.">
    <div className="space-y-6 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-7" /></div><p role="status" className="font-bold">비밀번호가 변경되었습니다.</p><Link href="/login" className={buttonVariants({ className: 'h-11 w-full rounded-xl' })}>새 비밀번호로 로그인하기</Link></div>
  </AuthShell>;

  if (!user) return <AuthShell title="재설정 링크 확인 필요" description="재설정 링크가 만료되었거나 올바르지 않습니다.">
    <div className="space-y-6 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"><CircleAlert className="size-7" /></div><Link href="/forgot-password" className={buttonVariants({ className: 'h-11 w-full rounded-xl' })}>재설정 메일 다시 받기</Link></div>
  </AuthShell>;

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  return <AuthShell title="새 비밀번호 설정" description="기존 비밀번호와 다른 새 비밀번호를 입력해 주세요." footer={<span>영문 대·소문자, 숫자, 특수문자를 각각 포함해야 합니다.</span>}>
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="space-y-2"><Label htmlFor="password">새 비밀번호</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={event => { setPassword(event.target.value); setError(''); }} aria-invalid={Boolean(error)} /><p className="text-xs text-muted-foreground">8~16자, 영문 대·소문자·숫자·특수문자 각각 1개 이상</p></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">새 비밀번호 확인</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setError(''); }} aria-invalid={passwordsMismatch} />{passwordsMismatch&&<p className="text-xs font-semibold text-destructive">비밀번호가 일치하지 않습니다.</p>}</div>
      {error&&<p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={saving}>{saving&&<LoaderCircle className="size-4 animate-spin" />}{saving ? '변경 중…' : '비밀번호 변경'}</Button>
    </form>
  </AuthShell>;
}
