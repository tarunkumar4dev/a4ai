// src/pages/AuthCallback.tsx
// Replace BOTH old files with this single one
// Delete: src/pages/auth/callback.tsx (old one)
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { takeRedirectAfterLogin } from "@/lib/authHelpers";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);

        // 1. Check for OAuth errors in URL
        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          throw new Error(oauthError === "access_denied"
            ? "Google sign-in was cancelled."
            : url.searchParams.get("error_description") || oauthError);
        }

        // 2. Exchange code for session (PKCE). The client (detectSessionInUrl) usually exchanges it already —
        //    a second exchange fails ("code verifier not found"), which used to show "Sign-in failed" after a
        //    successful login. Only exchange when there's no session yet, and ignore an error if one appears.
        const code = url.searchParams.get("code");
        if (code) {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) {
            const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (error && !(await supabase.auth.getSession()).data.session) throw error;
          }
        }

        // 3. Get user with retry (OAuth can be slow sometimes)
        let user = (await supabase.auth.getUser()).data?.user;
        if (!user) {
          await new Promise((r) => setTimeout(r, 300));
          user = (await supabase.auth.getUser()).data?.user;
        }
        if (!user) throw new Error("No user after OAuth");

        // 4. Determine role: metadata > localStorage pending > null
        const existingRole = user.user_metadata?.role;
        const pendingRole = localStorage.getItem("a4ai_pending_role");
        let finalRole = existingRole;

        if (!finalRole && pendingRole && ["student", "teacher", "institute"].includes(pendingRole)) {
          // Save pending role to user_metadata (Google sign-up from the Signup page)
          await supabase.auth.updateUser({ data: { role: pendingRole } });
          finalRole = pendingRole;
        } else if (!finalRole) {
          // Google sign-in from the Login page / modal for a brand-new account: the app treats a user without
          // a role as a teacher (AuthProvider default) — store that, instead of the old "student" fallback below.
          await supabase.auth.updateUser({ data: { role: "teacher" } });
          finalRole = "teacher";
        }
        localStorage.removeItem("a4ai_pending_role");

        // 5. Upsert profile in profiles table
        try {
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata?.full_name as string) ||
              (user.user_metadata?.name as string) ||
              "New User",
            role: finalRole,
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          // Non-fatal — profile might already exist or table might not exist yet
          console.debug("Profile upsert skipped:", (profileErr as any)?.message);
        }

        // 6. Clean URL
        window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);

        // 7. Check for redirect URL after successful auth
        const redirectUrl = takeRedirectAfterLogin(); // same-site app paths only

        const targetRole = (finalRole || "teacher").toLowerCase().trim();
        const fallbackDashboard = `/${targetRole}/dashboard`;

        if (redirectUrl) {
          navigate(redirectUrl, { replace: true });
          return;
        }

        // 8. Redirect using get_my_access home_route
        try {
          const { data: accessData } = await supabase.rpc('get_my_access');
          const access = accessData?.[0];
          navigate(access?.home_route || fallbackDashboard, { replace: true });
        } catch {
          navigate(fallbackDashboard, { replace: true });
        }
      } catch (error: any) {
        console.error("OAuth callback error:", error);
        toast({
          title: "Sign-in failed",
          description: error?.message || "Authentication error",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#E0E6F7]">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-black/20 border-t-black rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Completing authentication...</p>
      </div>
    </div>
  );
}