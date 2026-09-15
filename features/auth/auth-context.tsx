'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  clearSessionActivity,
  hasSessionActivityExpired,
  recordSessionActivity,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from '@/features/auth/session-activity';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    const authClient = client;

    function updateSession(nextSession: Session | null) {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setLoading(false);
    }

    async function expireInactiveSession() {
      if (!sessionRef.current || !hasSessionActivityExpired(window.localStorage)) return false;
      clearSessionActivity(window.localStorage);
      const { error } = await authClient.auth.signOut();
      if (error) console.error('비활성 세션 로그아웃 실패:', error.message);
      updateSession(null);
      return true;
    }

    void authClient.auth.getSession().then(async ({ data }) => {
      sessionRef.current = data.session;
      if (await expireInactiveSession()) return;
      if (data.session) recordSessionActivity(window.localStorage);
      updateSession(data.session);
    });

    const { data } = authClient.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_IN' && !sessionRef.current) {
        recordSessionActivity(window.localStorage);
      }
      if (event === 'SIGNED_OUT') clearSessionActivity(window.localStorage);
      updateSession(nextSession);
    });

    let lastRecordedAt = 0;
    function handleActivity() {
      if (!sessionRef.current) return;
      const now = Date.now();
      if (now - lastRecordedAt < 60_000) return;
      lastRecordedAt = now;
      recordSessionActivity(window.localStorage, now);
    }
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      void expireInactiveSession().then((expired) => {
        if (!expired) handleActivity();
      });
    }
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    for (const eventName of activityEvents) window.addEventListener(eventName, handleActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const expirationTimer = window.setInterval(() => {
      void expireInactiveSession();
    }, Math.min(60_000, SESSION_INACTIVITY_TIMEOUT_MS));

    return () => {
      data.subscription.unsubscribe();
      for (const eventName of activityEvents) window.removeEventListener(eventName, handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(expirationTimer);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured,
    loading,
    user: session?.user ?? null,
    async signOut() {
      const client = getSupabaseClient();
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      clearSessionActivity(window.localStorage);
    },
  }), [configured, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  return context;
}
