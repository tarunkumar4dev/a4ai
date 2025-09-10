// src/hooks/useUserProfile.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  updated_at?: string | null;
};

type ReturnType = {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

export const useUserProfile = (): ReturnType => {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const setSafe = useCallback(<T,>(setter: (v: T) => void, v: T) => {
    if (mountedRef.current) setter(v);
  }, []);

  const fetchProfile = useCallback(
    async (uid: string) => {
      // Bounded retry: handles small delay before trigger/upsert creates row
      const delays = [200, 500, 1000]; // ms
      let lastErr: any = null;

      for (let i = 0; i < delays.length + 1; i++) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id,email,full_name,avatar_url,role,updated_at")
            .eq("id", uid)
            .maybeSingle();

          if (error) {
            // If RLS blocks or table missing, surface once
            lastErr = error;
          } else {
            setSafe(setProfile, (data as ProfileRow) ?? null);
            return;
          }
        } catch (e) {
          lastErr = e;
        }
        if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]));
      }

      console.warn("Profile fetch failed:", lastErr);
      setSafe(setProfile, null);
    },
    [setSafe]
  );

  const refreshProfile = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (uid) await fetchProfile(uid);
  }, [fetchProfile]);

  // Manage realtime subscription to this user's profile row
  const ensureRealtimeForUser = useCallback(
    (uid: string | null) => {
      // Cleanup previous channel
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch {}
        realtimeChannelRef.current = null;
      }
      if (!uid) return;

      const channel = supabase
        .channel(`profiles:row:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${uid}`,
          },
          (payload) => {
            // Live-update profile
            const row = (payload.new ?? payload.old) as ProfileRow | undefined;
            if (row && mountedRef.current && currentUserIdRef.current === uid) {
              setProfile(row);
            }
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      setSafe(setLoading, true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sess = data.session ?? null;
        const u = sess?.user ?? null;

        currentUserIdRef.current = u?.id ?? null;
        setSafe(setSession, sess);
        setSafe(setUser, u);
        setSafe(setProfile, null);

        ensureRealtimeForUser(u?.id ?? null);

        if (u?.id) {
          await fetchProfile(u.id);
        }
      } finally {
        setSafe(setLoading, false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evt, newSession) => {
      const u = newSession?.user ?? null;
      currentUserIdRef.current = u?.id ?? null;

      setSafe(setSession, newSession ?? null);
      setSafe(setUser, u);
      setSafe(setProfile, null);
      setSafe(setLoading, true);

      ensureRealtimeForUser(u?.id ?? null);

      if (u?.id) await fetchProfile(u.id);
      setSafe(setLoading, false);
    });

    return () => {
      mountedRef.current = false;
      listener?.subscription?.unsubscribe();
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch {}
        realtimeChannelRef.current = null;
      }
    };
  }, [ensureRealtimeForUser, fetchProfile, setSafe]);

  // Stable return shape
  return useMemo(
    () => ({ user, session, profile, loading, refreshProfile }),
    [user, session, profile, loading, refreshProfile]
  );
};
