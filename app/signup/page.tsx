'use client';

import Link from 'next/link';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/features/auth/auth-shell';
import { validateNickname, validatePassword, validateUsername } from '@/features/auth/validation';

type Field = 'username' | 'nickname';
type CheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';
type SubmitMessage = { type: 'success' | 'error'; text: string } | null;
const initialCheckStatus: Record<Field, CheckStatus> = { username: 'idle', nickname: 'idle' };

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', nickname: '', email: '', password: '', confirmPassword: '' });
  const [checkStatus, setCheckStatus] = useState(initialCheckStatus);
  const [submitMessage, setSubmitMessage] = useState<SubmitMessage>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setSubmitMessage(null);
    if (key === 'username' || key === 'nickname') setCheckStatus(current => ({ ...current, [key]: 'idle' }));
  };

  async function check(field: Field) {
    const validation = field === 'username' ? validateUsername(form.username) : validateNickname(form.nickname);
    if (validation) {
      setCheckStatus(current => ({ ...current, [field]: 'error' }));
      setSubmitMessage({ type: 'error', text: validation });
      return;
    }
    setSubmitMessage(null);
    setCheckStatus(current => ({ ...current, [field]: 'checking' }));
    try {
      const response = await fetch(`/api/auth/availability?field=${field}&value=${encodeURIComponent(form[field])}`);
      if (!response.ok) throw new Error('CHECK_FAILED');
      const result = await response.json() as { available?: boolean };
      setCheckStatus(current => ({ ...current, [field]: result.available ? 'available' : 'unavailable' }));
    } catch {
      setCheckStatus(current => ({ ...current, [field]: 'error' }));
      setSubmitMessage({ type: 'error', text: '중복 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitMessage(null);
    const validation = validateUsername(form.username) || validateNickname(form.nickname) || validatePassword(form.password);
    if (validation) return setSubmitMessage({ type: 'error', text: validation });
    if (form.password !== form.confirmPassword) return setSubmitMessage({ type: 'error', text: '비밀번호 확인이 일치하지 않습니다.' });
    if (checkStatus.username !== 'available' || checkStatus.nickname !== 'available') return setSubmitMessage({ type: 'error', text: '아이디와 닉네임 중복 확인을 완료해 주세요.' });
    if (!agreed) return setSubmitMessage({ type: 'error', text: '서비스 이용 안내와 개인정보 처리 안내에 동의해 주세요.' });
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '회원가입에 실패했습니다.');
      window.sessionStorage.setItem('signup-complete', 'true');
      router.replace('/login');
    } catch {
      setSubmitMessage({ type: 'error', text: '회원가입에 실패했습니다. 입력 정보 또는 이미 가입된 이메일인지 확인해 주세요.' });
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell title="회원가입" description="계정을 만들고 나만의 지원 조건과 준비 상태를 안전하게 저장하세요." footer={<><span>이미 계정이 있나요? </span><Link href="/login" className="font-bold text-primary">로그인</Link></>}>
    <form className="space-y-4" onSubmit={submit}>
      <CheckField label="아이디" value={form.username} onChange={value => update('username', value)} onCheck={() => void check('username')} status={checkStatus.username} hint="4~20자, 영문·숫자만 사용" />
      <CheckField label="닉네임" value={form.nickname} onChange={value => update('nickname', value)} onCheck={() => void check('nickname')} status={checkStatus.nickname} hint="2~16자, 한글·영문·숫자·-·_ 사용" />
      <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" type="email" autoComplete="email" value={form.email} onChange={event => update('email', event.target.value)} required /><p className="text-xs text-muted-foreground">비밀번호 재설정에 사용됩니다.</p></div>
      <div className="space-y-2"><Label htmlFor="new-password">비밀번호</Label><Input id="new-password" type="password" autoComplete="new-password" value={form.password} onChange={event => update('password', event.target.value)} required /><p className="text-xs text-muted-foreground">8~16자, 영문 대·소문자·숫자·특수문자 각각 1개 이상</p></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">비밀번호 확인</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} required /></div>
      {submitMessage && <div role={submitMessage.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${submitMessage.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{submitMessage.type === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}<span>{submitMessage.text}</span></div>}
      <label className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" /><span><Link href="/terms" className="font-bold text-primary">서비스 이용 안내</Link>와 <Link href="/privacy" className="font-bold text-primary">개인정보 처리 안내</Link>를 확인했으며 이에 동의합니다. (필수)</span></label><Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>{loading && <LoaderCircle className="size-4 animate-spin" />}{loading ? '가입 중…' : '회원가입'}</Button>
    </form>
  </AuthShell>;
}

function CheckField({ label, value, onChange, onCheck, status, hint }: { label: string; value: string; onChange: (value: string) => void; onCheck: () => void; status: CheckStatus; hint: string }) {
  const id = label === '아이디' ? 'username' : 'nickname';
  const available = status === 'available';
  const unavailable = status === 'unavailable';
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex gap-2">
      <Input id={id} value={value} onChange={event => onChange(event.target.value)} className={available ? 'border-primary ring-1 ring-primary/20' : unavailable ? 'border-destructive' : ''} required />
      <Button type="button" variant={available ? 'default' : 'outline'} className="min-w-24 shrink-0" onClick={onCheck} disabled={status === 'checking'}>{status === 'checking' ? <><LoaderCircle className="size-4 animate-spin" /> 확인 중</> : available ? <><CheckCircle2 className="size-4" /> 확인 완료</> : '중복 확인'}</Button>
    </div>
    {available ? <p className="flex items-center gap-1 text-xs font-semibold text-primary"><CheckCircle2 className="size-3.5" />사용 가능한 {label}입니다. 확인이 완료됐습니다.</p> : unavailable ? <p className="flex items-center gap-1 text-xs font-semibold text-destructive"><CircleAlert className="size-3.5" />이미 사용 중인 {label}입니다.</p> : <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>;
}
