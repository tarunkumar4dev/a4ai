import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://dcmnzvjftmdbywrjkust.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbW56dmpmdG1kYnl3cmprdXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNDU0MTAsImV4cCI6MjA2MjgyMTQxMH0.lcHneNl7SMvxf_2FbBcSUcTsKY-9HEPdTarSZacwtt8";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  }
);