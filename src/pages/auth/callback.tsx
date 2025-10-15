// src/pages/AuthCallback.tsx
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ran = useRef(false);
  const loc = useLocation();

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const url = new URL(window.location.href);

        // 0) If Supabase sent an error back in the URL (common when redirect URLs mismatch)
        const oauthErr = url.searchParams.get("error");
        const oauthErrDesc = url.searchParams.get("error_description");
        if (oauthErr) {
          throw new Error(oauthErrDesc || oauthErr);
        }

        // 1) If we have an OAuth code, exchange it for a session
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchError) throw exchError;
        }

        // 2) Confirm session/user is now present (retry once if needed)
        let { data: userResp, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        if (!userResp?.user) {
          // small retry after a short tick (some providers take a moment)
          await new Promise((r) => setTimeout(r, 250));
          const retry = await supabase.auth.getUser();
          if (retry.error) throw retry.error;
          userResp = retry.data;
        }

        const user = userResp?.user;
        if (!user) throw new Error("No user after OAuth exchange");

        // 3) (Optional) Safe profile upsert — won’t crash if RLS/trigger already handles it
        try {
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata?.full_name as string) ||
              (user.user_metadata?.name as string) ||
              "New User",
            role: "teacher",
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          // Non-fatal: your DB trigger likely created the profile already
          console.debug("Profile upsert skipped:", (profileErr as any)?.message);
        }

        // 4) Clean URL (remove code/error params) then go to dashboard (or next=…)
        const next = new URLSearchParams(loc.search).get("next") || "/dashboard";
        window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);
        navigate(next, { replace: true, state: { from: "oauth-callback" } });
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
    })();
  }, [loc.search, navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your session</p>
      </div>
    </div>
  );
}
