import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
}

const AccessContext = createContext<AccessState>({ access: null, loading: true });

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  // access + the user id it was fetched for; loading is derived so there's no
  // render where a fresh session looks "loaded" with access = null (F5 → /login bug)
  const [fetched, setFetched] = useState<{ userId: string | null; access: AccessData | null }>({
    userId: null,
    access: null,
  });

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    supabase
      .rpc('get_my_access')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('get_my_access failed:', error);
        setFetched({ userId, access: data?.[0] ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  const loading = authLoading || (!!userId && fetched.userId !== userId);
  const access = userId && fetched.userId === userId ? fetched.access : null;
  const value = useMemo<AccessState>(() => ({ access, loading }), [access, loading]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = () => useContext(AccessContext);