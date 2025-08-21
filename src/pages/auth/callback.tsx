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
        // 1) Exchange ?code=... for a session (PKCE flow)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (exchangeError) throw exchangeError;

        // 2) Confirm we have a logged-in user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("No user found after authentication");

        // 3) Ensure a profile row exists (adjust columns as per your schema)
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "New User",
            role: "teacher",
            updated_at: new Date().toISOString(),
          });
        if (profileError) throw profileError;

        // 4) Optional toast
        toast({ title: "Signed in", description: `Welcome back, ${user.email}` });

        // 5) Redirect to intended path if present (?next=/foo) else dashboard
        const params = new URLSearchParams(location.search);
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
  }, [navigate, location.search, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication…</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your session.</p>
      </div>
    </div>
  );
}
