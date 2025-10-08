// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      try {
        // 1) Always exchange the auth code for a session on redirect flow
        const url = new URL(window.location.href);
        const hasCode = !!url.searchParams.get("code");

        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }

        // 2) Now a session should exist; fetch the user
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error("No user after OAuth exchange");

        // 3) Upsert profile (adjust fields as your schema requires)
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || "New User",
          role: "teacher",
          updated_at: new Date().toISOString(),
        });
        if (profileError) throw profileError;

        // 4) Clean the URL (remove code) and go to dashboard
        window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);
        navigate("/dashboard", { replace: true, state: { from: "oauth-callback" } });
      } catch (e: any) {
        console.error("OAuth callback error:", e);
        toast({
          title: "Sign-in failed",
          description: e?.message || "Authentication error",
          variant: "destructive",
        });
        navigate("/login", {
          replace: true,
          state: { error: e?.message || "Authentication error" },
        });
      }
    };

    run();
  }, [navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your session</p>
      </div>
    </div>
  );
}
