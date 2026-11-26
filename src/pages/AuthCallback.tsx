// src/pages/AuthCallback.tsx
// OAuth + email-confirmation callback. Determines role and redirects to the right dashboard.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { redirectToHome } from "@/lib/homeRoute";

const VALID_ROLES = ["student", "teacher", "institute"];

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

        // 2. Exchange code for session (PKCE)
        const code = url.searchParams.get("code");
        if (code) {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) {
            const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (error && !(await supabase.auth.getSession()).data.session) throw error;
          }
        }

        // 3. Get user with retry
        let user = (await supabase.auth.getUser()).data?.user;
        if (!user) {
          await new Promise((r) => setTimeout(r, 300));
          user = (await supabase.auth.getUser()).data?.user;
        }
        if (!user) throw new Error("No user after OAuth");

        // 4. Determine role: URL param > localStorage > existing metadata > /select-role
        const existingRole = user.user_metadata?.role;
        const urlRole = url.searchParams.get("signup_role");
        const pendingRole = localStorage.getItem("a4ai_pending_role");

        let finalRole = existingRole;

        if (!finalRole && urlRole && VALID_ROLES.includes(urlRole)) {
          await supabase.auth.updateUser({ data: { role: urlRole } });
          finalRole = urlRole;
        } else if (!finalRole && pendingRole && VALID_ROLES.includes(pendingRole)) {
          await supabase.auth.updateUser({ data: { role: pendingRole } });
          finalRole = pendingRole;
        } else if (!finalRole) {
          // No role from any source — send to role selection instead of guessing
          localStorage.removeItem("a4ai_pending_role");
          window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);
          navigate("/select-role", { replace: true });
          return;
        }
        localStorage.removeItem("a4ai_pending_role");

        // 5. Ensure profile row
        try {
          const fullName =
            (user.user_metadata?.full_name as string) ||
            (user.user_metadata?.name as string) ||
            "New User";
          await supabase.from("profiles").upsert(
            { id: user.id, email: user.email, full_name: fullName, role: finalRole },
            { onConflict: "id", ignoreDuplicates: true }
          );
          await supabase.from("profiles").update({
            email: user.email,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          }).eq("id", user.id);
        } catch (profileErr) {
          console.debug("Profile upsert skipped:", (profileErr as any)?.message);
        }

        // 6. If institute signup, try creating the institute (idempotent)
        if (finalRole === "institute") {
          const instName =
            (user.user_metadata?.institute_name as string) ||
            localStorage.getItem("a4ai_pending_institute_name") ||
            null;
          localStorage.removeItem("a4ai_pending_institute_name");

          if (instName) {
            // Skip if user already owns an institute (double-click / refresh safety)
            let alreadyHasInstitute = false;
            try {
              const { data: acc } = await supabase.rpc("get_my_access");
              if (acc?.[0]?.institute_id) alreadyHasInstitute = true;
            } catch { /* can't check — try creating anyway */ }

            if (!alreadyHasInstitute) {
              try {
                const { error: rpcErr } = await supabase.rpc("create_institute", { p_name: instName });
                if (rpcErr) {
                  const msg = (rpcErr.message || "").toLowerCase();
                  if (!msg.includes("duplicate") && !msg.includes("unique")) {
                    toast({ title: "Could not create institute", description: "You can create it from the dashboard.", variant: "destructive" });
                  }
                }
              } catch {
                toast({ title: "Could not create institute", description: "You can create it from the dashboard.", variant: "destructive" });
              }
            }
            // Clear the metadata field so it doesn't trigger again
            await supabase.auth.updateUser({ data: { institute_name: null } }).catch(() => {});
          }
          window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);
          window.location.assign("/institute");
          return;
        }

        // 7. Clean URL
        window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);

        // 8. Redirect via the single shared helper
        await redirectToHome(navigate, finalRole);
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
