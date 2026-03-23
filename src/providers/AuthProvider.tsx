// src/providers/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "teacher" | "institute" | null;

type AuthCtx = {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
  updateRole: (role: NonNullable<Role>) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  updateRole: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  // Extract role from user metadata
  const extractRole = (user: User | null | undefined): Role => {
    if (!user) return null;
    const r = user.user_metadata?.role;
    if (r === "student" || r === "teacher" || r === "institute") return r;
    return null;
  };

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setRole(extractRole(data.session?.user));
      setLoading(false);
    })();

    // 2. Listen for auth changes (login, logout, token refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess ?? null);
        setRole(extractRole(sess?.user));
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("a4ai_pending_role");
    setSession(null);
    setRole(null);
  };

  // Update role in Supabase user_metadata + local state
  const updateRole = async (newRole: NonNullable<Role>) => {
    const { error } = await supabase.auth.updateUser({
      data: { role: newRole },
    });
    if (error) throw error;
    setRole(newRole);
    localStorage.removeItem("a4ai_pending_role");
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signOut,
        updateRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}