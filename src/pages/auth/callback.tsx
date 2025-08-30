// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.get("code");

        // If someone hits /auth/callback directly without a code
        if (!hasCode) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            navigate("/dashboard", { replace: true });
            return;
          }
          navigate("/login", { replace: true });
          return;
        }

        // 1) Exchange ?code=... → session (PKCE)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          url.toString()
        );
        if (exchangeError) throw exchangeError;

        // 2) Confirm user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("No user found after authentication");

        // 3) Ensure profile row
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

        // 4) Toast (optional)
        // toast({ title: "Signed in", description: `Welcome back, ${user.email}` });

        // 5) Redirect to ?next or /dashboard
        const next = url.searchParams.get("next") || "/dashboard";
        navigate(next, { replace: true });
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        toast({
          title: "Authentication failed",
          description:
            err?.message ?? "Something went wrong while signing you in.",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, location.search, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication…</h2>
        <p className="text-gray-500 mt-2">
          Please wait while we verify your session.
        </p>
      </div>
    </div>
  );
}
