
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const useUserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("User fetch error:", userError?.message);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("Profile not found:", error.message, "for user:", user.id);
        setProfile(null);
      } else {
        setProfile(data);
      }

      setLoading(false);
    };

    getProfile();
  }, []);

  return { profile, loading };
};