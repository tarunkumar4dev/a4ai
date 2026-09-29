import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export interface AccessData {
  institute_id: string | null;
  institute_name: string | null;
  primary_role: 'admin' | 'hod' | 'proctor' | 'teacher' | 'none';
  home_route: string;
  hod_department_ids: string[];
  proctor_section_ids: string[];
  teaching_batch_ids: string[];
}

interface AccessState { access: AccessData | null; loading: boolean; }

const AccessContext = createContext<AccessState>({ access: null, loading: true });

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [state, setState] = useState<AccessState>({ access: null, loading: true });

  useEffect(() => {
    if (!session?.user) { setState({ access: null, loading: false }); return; }
    setState(s => ({ ...s, loading: true }));
    supabase.rpc('get_my_access').then(({ data, error }) => {
      if (error) console.error('get_my_access failed:', error);
      setState({ access: data?.[0] ?? null, loading: false });
    });
  }, [session?.user?.id]);

  return <AccessContext.Provider value={state}>{children}</AccessContext.Provider>;
};

export const useAccess = () => useContext(AccessContext);
export const useAccess = () => useContext(AccessContext);