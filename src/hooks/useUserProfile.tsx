
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";

export const useUserProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const getProfile = async () => {
      // user comes from AuthProvider (restored session) — no extra network round trip that can fail offline
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Profile not found:", error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }

      setLoading(false);
    };

    getProfile();
  }, [authLoading, userId]);

  return { profile, loading };
};