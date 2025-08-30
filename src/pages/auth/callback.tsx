// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        // ---- Build a proper URL for Supabase to parse (handles HashRouter) ----
        const { origin, href, hash } = window.location;
        let urlForExchange = href;

        // If using HashRouter, the query comes after '#'
        // e.g. https://a4ai.in/#/auth/callback?code=...&state=...&next=/dashboard
        const qIndex = hash.indexOf("?");
        const hasHashQuery = qIndex !== -1;
        if (hasHashQuery) {
          const query = hash.slice(qIndex + 1); // "code=...&state=...&next=..."
          urlForExchange = `${origin}/auth/callback?${query}`;
        }

        const urlObj = new URL(urlForExchange);
        const hasCode =
          urlObj.searchParams.get("code") || urlObj.searchParams.get("access_token");

        // If the page was opened without OAuth params, try existing session or go to /login
        if (!hasCode) {
          const { data: { session } } = await supabase.auth.getSession();
          navigate(session ? "/dashboard" : "/login", { replace: true });
          return;
        }

        // ---- Exchange the code for a session (PKCE) ----
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(urlForExchange);
        if (exchangeError) throw exchangeError;

        // ---- Confirm user ----
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("No user found after authentication");

        // ---- Ensure profile row (adjust columns as per your schema) ----
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "New User",
              role: "teacher",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        if (profileError) throw profileError;

        // ---- Redirect to ?next or /dashboard ----
        const params = hasHashQuery
          ? new URLSearchParams(hash.slice(qIndex + 1))
          : urlObj.searchParams;
        const next = params.get("next") || "/dashboard";

        navigate(next, { replace: true });
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        toast({
          title: "Authentication failed",
          description: err?.message ?? "Something went wrong while signing you in.",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication…</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your session.</p>
      </div>
    </div>
  );
}
