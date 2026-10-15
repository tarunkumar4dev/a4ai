import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  /** get_my_access failed (network / server) — NOT the same as "no access"; don't send the user to /login */
  failed: boolean;
  retry: () => void;
}

const AccessContext = createContext<AccessState>({ access: null, loading: true, failed: false, retry: () => {} });

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  // access + the user id it was fetched for; loading is derived so there's no
  // render where a fresh session looks "loaded" with access = null (F5 → /login bug)
  const [fetched, setFetched] = useState<{ userId: string | null; access: AccessData | null; failed: boolean }>({
    userId: null,
    access: null,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    supabase
      .rpc('get_my_access')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('get_my_access failed:', error.message);
        setFetched({ userId, access: data?.[0] ?? null, failed: !!error });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, attempt]);

  // A failed lookup (e.g. laptop just woke, network not up yet) retries once the browser is back online.
  const failedNow = !!userId && fetched.userId === userId && fetched.failed;
  useEffect(() => {
    if (!failedNow) return;
    const again = () => setAttempt((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [failedNow]);

  const retry = useCallback(() => {
    setFetched((f) => ({ ...f, userId: null }));
    setAttempt((n) => n + 1);
  }, []);

  const loading = authLoading || (!!userId && fetched.userId !== userId);
  const access = userId && fetched.userId === userId ? fetched.access : null;
  const value = useMemo<AccessState>(
    () => ({ access, loading, failed: failedNow, retry }),
    [access, loading, failedNow, retry],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = () => useContext(AccessContext);