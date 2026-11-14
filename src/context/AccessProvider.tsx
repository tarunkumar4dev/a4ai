import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

export interface AccessData {
  institute_id: string | null;
  institute_name: string | null;
  primary_role: 'admin' | 'hod' | 'proctor' | 'teacher' | 'none';
  home_route: string;
  hod_department_ids: string[];
  proctor_section_ids: string[];
  teaching_batch_ids: string[];
}

interface AccessState {
  access: AccessData | null;
  loading: boolean;
  /** Set only when get_my_access failed and no access is known for this user (network down, server error). */
  error: string | null;
  /** Fetch get_my_access again (RoleRoute's Retry button). */
  refresh: () => void;
}

const AccessContext = createContext<AccessState>({ access: null, loading: true, error: null, refresh: () => {} });

/** Waits after the 1st and 2nd failed attempt; then the error is shown. */
const ACCESS_RETRY_DELAYS_MS = [1000, 3000];
/** Window focus re-checks permissions at most this often (TOKEN_REFRESHED / online always re-check). */
const ACCESS_FOCUS_MIN_GAP_MS = 30_000;

// error = null → success (tsconfig is not strict, so a boolean-tagged union would not narrow)
type FetchResult = { access: AccessData | null; error: string | null };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAccessWithRetry(delays: number[] = ACCESS_RETRY_DELAYS_MS): Promise<FetchResult> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase.rpc('get_my_access');
    if (!error) return { access: data?.[0] ?? null, error: null };
    if (attempt >= delays.length) return { access: null, error: error.message || 'get_my_access failed' };
    await sleep(delays[attempt]);
  }
}

const sameAccess = (a: AccessData | null, b: AccessData | null) => JSON.stringify(a) === JSON.stringify(b);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  // access + the user id it was fetched for; loading is derived so there's no
  // render where a fresh session looks "loaded" with access = null (F5 → /login bug)
  const [fetched, setFetched] = useState<{ userId: string | null; access: AccessData | null; error: string | null }>({
    userId: null,
    access: null,
    error: null,
  });
  const inFlight = useRef<string | null>(null); // user id whose check is running
  const lastCheck = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  const load = useCallback(async () => {
    const uid = userRef.current;
    if (!uid || inFlight.current === uid) return; // focus + TOKEN_REFRESHED often fire together: one request is enough
    inFlight.current = uid;
    lastCheck.current = Date.now();
    // Retry after an error: show "Loading…" again instead of the error screen
    setFetched(prev => (prev.error ? { userId: null, access: null, error: null } : prev));
    try {
      const res = await fetchAccessWithRetry();
      if (userRef.current !== uid) return; // signed out / switched user meanwhile
      setFetched(prev => {
        const known = prev.userId === uid;
        if (res.error) {
          console.error('get_my_access failed:', res.error);
          // Keep what we already know for this user (a re-check that fails must not lock anyone out);
          // only a user with no access loaded yet gets the error screen — never a redirect to /login.
          return known && !prev.error ? prev : { userId: uid, access: null, error: res.error };
        }
        // Same permissions → same object, so nothing below re-renders or refetches
        if (known && !prev.error && sameAccess(prev.access, res.access)) return prev;
        return { userId: uid, access: res.access, error: null };
      });
    } finally {
      if (inFlight.current === uid) inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    if (authLoading || !userId) return;
    load();
  }, [authLoading, userId, load]);

  // Permissions can change while the app is open (HOD removed, member deactivated): re-check on focus,
  // when the network comes back and after every token refresh. RLS enforces it on the server either way.
  useEffect(() => {
    if (!userId) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (Date.now() - lastCheck.current < ACCESS_FOCUS_MIN_GAP_MS) return;
      load();
    };
    const onOnline = () => load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      // no supabase call inside the auth callback itself (it holds the auth lock) → next tick
      if (event === 'TOKEN_REFRESHED') setTimeout(load, 0);
    });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, load]);

  const loading = authLoading || (!!userId && fetched.userId !== userId);
  const mine = !!userId && fetched.userId === userId;
  const access = mine ? fetched.access : null;
  const error = mine ? fetched.error : null;
  const value = useMemo<AccessState>(() => ({ access, loading, error, refresh: load }), [access, loading, error, load]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = () => useContext(AccessContext);
