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
import { signOut as signOutThisDevice } from "@/lib/auth";

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
    // The one auth subscription in the app. INITIAL_SESSION fires once the stored session has been
    // restored (and refreshed if it had expired), so `loading` stays true until then — no flash of /login.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      switch (event) {
        case "SIGNED_OUT":
          setSession(null);
          setUser(null);
          extractUserInfo(null);
          break;
        case "TOKEN_REFRESHED":
          // new access token, same user: keep the user object so effects keyed on it don't re-run
          setSession(currentSession);
          setUser((prev) => (prev && prev.id === currentSession?.user?.id ? prev : currentSession?.user ?? null));
          break;
        default: // INITIAL_SESSION, SIGNED_IN, USER_UPDATED, PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          extractUserInfo(currentSession?.user ?? null);
      }
      setLoading(false);

      if (event === "SIGNED_IN" && currentSession?.user) {
        const signedInUser = currentSession.user;
        // Supabase calls inside this callback can deadlock the auth lock — run them after it returns.
        setTimeout(() => ensureProfileExists(signedInUser), 0);
      }
    });

    // Laptop woke up / came back online: re-read the session, which refreshes an expired access token.
    // (supabase-js already does this on tab visibility changes.)
    const recheck = () => {
      if (document.visibilityState === "visible") void supabase.auth.getSession();
    };
    window.addEventListener("online", recheck);
    window.addEventListener("focus", recheck);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", recheck);
      window.removeEventListener("focus", recheck);
    };
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
    await signOutThisDevice();
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