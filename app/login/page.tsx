'use client';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/features/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router=useRouter(); const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [signupComplete,setSignupComplete]=useState(false); const [loading,setLoading]=useState(false);
  useEffect(()=>{if(window.sessionStorage.getItem('signup-complete')==='true'){setSignupComplete(true);window.sessionStorage.removeItem('signup-complete')}},[]);
  async function submit(event:React.FormEvent){event.preventDefault();setLoading(true);setError('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});const result=await response.json() as {accessToken?:string;refreshToken?:string;error?:string};if(!response.ok||!result.accessToken||!result.refreshToken)throw new Error(result.error||'아이디 또는 비밀번호를 확인해 주세요.');const client=getSupabaseClient();if(!client)throw new Error('로그인 서버에 연결할 수 없습니다.');const {error:sessionError}=await client.auth.setSession({access_token:result.accessToken,refresh_token:result.refreshToken});if(sessionError)throw new Error('로그인 정보를 저장하지 못했습니다.');router.replace('/');}catch(error){setError(error instanceof Error?error.message:'아이디 또는 비밀번호를 확인해 주세요.');}finally{setLoading(false)}}
  return <AuthShell title="로그인" description="저장한 조건과 관심 공고를 이어서 확인하세요." footer={<div className="space-y-2"><p><span>아직 계정이 없나요? </span><Link href="/signup" className="font-bold text-primary">회원가입</Link></p><p><Link href="/forgot-password" className="font-semibold text-primary">비밀번호 재설정</Link></p></div>}><form className="space-y-4" onSubmit={submit}>{signupComplete&&<p role="status" className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary"><CheckCircle2 className="size-4"/>회원가입이 완료되었습니다. 로그인해 주세요.</p>}<div className="space-y-2"><Label htmlFor="username">아이디</Label><Input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></div><div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>{error&&<p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>{loading?'로그인 중…':'로그인'}</Button></form></AuthShell>;
}
