// src/providers/AuthProvider.tsx
// Updated to handle Phone OTP + Google OAuth users
// Ensures phone users get proper role/metadata

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: string;
  phone: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateRole: (newRole: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: "teacher",
  phone: null,
  loading: true,
  signOut: async () => {},
  updateRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("teacher");
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const extractUserInfo = (currentUser: User | null) => {
    if (!currentUser) {
      setRole("teacher");
      setPhone(null);
      return;
    }

    const userRole =
      currentUser.user_metadata?.role ||
      currentUser.app_metadata?.role ||
      "teacher";
    setRole(userRole);

    const userPhone =
      currentUser.phone ||
      currentUser.user_metadata?.phone ||
      null;
    setPhone(userPhone);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      extractUserInfo(currentSession?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      extractUserInfo(currentSession?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN" && currentSession?.user) {
        ensureProfileExists(currentSession.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfileExists = async (currentUser: User) => {
    try {
      const { data: existingProfile } = await supabase
        .from("teacher_profiles")
        .select("id")
        .eq("id", currentUser.id)
        .single();

      if (!existingProfile) {
        const { data: freePlan } = await supabase
          .from("plans")
          .select("id")
          .eq("slug", "free")
          .single();

        if (freePlan) {
          await supabase.from("teacher_profiles").upsert({
            id: currentUser.id,
            phone: currentUser.phone || null,
            email: currentUser.email || null,
            full_name:
              currentUser.user_metadata?.full_name ||
              currentUser.user_metadata?.name ||
              "",
            role: "teacher",
            plan_id: freePlan.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          await supabase.from("subscriptions").upsert({
            user_id: currentUser.id,
            plan_id: freePlan.id,
            status: "active",
            starts_at: new Date().toISOString(),
            ends_at: new Date(
              Date.now() + 365 * 100 * 24 * 60 * 60 * 1000
            ).toISOString(),
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn("Profile ensure check:", err);
    }
  };

  const updateRole = async (newRole: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { role: newRole },
    });
    if (error) throw error;
    setRole(newRole);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("teacher");
    setPhone(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, phone, loading, signOut, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}