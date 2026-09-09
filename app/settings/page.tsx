'use client';

import Link from 'next/link';
import { ArrowLeft, Bell, ShieldAlert, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';

type Notification = {
  id: number;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { loading, user, signOut } = useAuth();
  const [newMatchEnabled, setNewMatchEnabled] = useState(true);
  const [deadlineEnabled, setDeadlineEnabled] = useState(true);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !user) return;
    void Promise.all([
      client.from('notification_preferences').select('new_match_enabled,deadline_enabled,deadline_days').eq('user_id', user.id).maybeSingle(),
      client.from('user_notifications').select('id,title,message,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]).then(([preferenceResult, notificationResult]) => {
      if (preferenceResult.data) {
        setNewMatchEnabled(preferenceResult.data.new_match_enabled);
        setDeadlineEnabled(preferenceResult.data.deadline_enabled);
        setDeadlineDays(preferenceResult.data.deadline_days);
      }
      if (notificationResult.data) setNotifications(notificationResult.data);
      void client.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    });
  }, [user]);

  async function savePreferences() {
    const client = getSupabaseClient();
    if (!client || !user || saving) return;
    setSaving(true);
    setMessage('');
    const { error } = await client.from('notification_preferences').upsert({
      user_id: user.id,
      new_match_enabled: newMatchEnabled,
      deadline_enabled: deadlineEnabled,
      deadline_days: deadlineDays,
      updated_at: new Date().toISOString(),
    });
    setMessage(error ? '알림 설정을 저장하지 못했습니다.' : '알림 설정을 저장했습니다.');
    setSaving(false);
  }

  async function deleteAccount() {
    const client = getSupabaseClient();
    if (!client) return;
    setSaving(true);
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      setMessage('계정을 삭제하지 못했습니다. 다시 시도해 주세요.');
      setSaving(false);
      return;
    }
    await signOut();
    router.replace('/login');
  }

  if (loading || !user)
    return <main className="grid min-h-screen place-items-center"><p>설정을 불러오고 있습니다…</p></main>;

  return (
    <main className="min-h-screen bg-background px-8 py-9 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />홈으로</Link>
        <div><h1 className="text-3xl font-black">알림 및 개인정보 설정</h1><p className="mt-2 text-sm text-muted-foreground">맞춤 공고 알림을 관리하고 내 계정을 삭제할 수 있습니다.</p></div>
        {message && <p role="status" className="rounded-xl border bg-white p-4 text-sm font-bold">{message}</p>}

        <section className="rounded-2xl border bg-white p-6">
          <div className="mb-5 flex items-center gap-2"><Bell className="size-5 text-primary" /><h2 className="text-lg font-extrabold">맞춤 공고 알림</h2></div>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary p-4"><span><strong className="block">새로운 지원 가능 공고</strong><small className="text-muted-foreground">자동 재판정에서 가능성 있음으로 나온 새 공고를 알려드립니다.</small></span><input type="checkbox" checked={newMatchEnabled} onChange={(event) => setNewMatchEnabled(event.target.checked)} /></label>
            <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary p-4"><span><strong className="block">접수 마감 알림</strong><small className="text-muted-foreground">마감일이 확인된 관심 공고를 미리 알려드립니다.</small></span><input type="checkbox" checked={deadlineEnabled} onChange={(event) => setDeadlineEnabled(event.target.checked)} /></label>
            <label className="flex items-center gap-3 text-sm font-bold">마감 며칠 전 알림<input type="number" min="1" max="30" value={deadlineDays} onChange={(event) => setDeadlineDays(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} className="w-20 rounded-lg border p-2" /></label>
            <Button className="min-h-10 h-auto px-4 py-2" onClick={() => void savePreferences()} disabled={saving}>{saving ? '저장 중…' : '알림 설정 저장'}</Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-extrabold">최근 알림</h2>
          <div className="mt-4 space-y-2">
            {notifications.length ? notifications.map((notification) => <div key={notification.id} className="rounded-xl border p-4"><strong className="text-sm">{notification.title}</strong><p className="mt-1 text-sm text-muted-foreground">{notification.message}</p><time className="mt-2 block text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString('ko-KR')}</time></div>) : <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">아직 생성된 알림이 없습니다.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-destructive/30 bg-white p-6">
          <div className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5" /><h2 className="text-lg font-extrabold">계정 및 개인정보 삭제</h2></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">계정을 삭제하면 프로필, 관심 공고, 서류 체크, 판정 결과와 활동 기록이 함께 삭제되며 복구할 수 없습니다.</p>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" className="mt-4 min-h-10 h-auto px-4 py-2" />}><Trash2 className="size-4" />계정 영구 삭제</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>계정과 개인정보를 모두 삭제할까요?</AlertDialogTitle><AlertDialogDescription>삭제 후에는 복구할 수 없습니다. 저장한 공고와 서류 준비 상태도 함께 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteAccount()} disabled={saving}>영구 삭제</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </main>
  );
}
