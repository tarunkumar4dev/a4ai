// src/pages/AuthCallback.tsx
// Replace BOTH old files with this single one
// Delete: src/pages/auth/callback.tsx (old one)
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

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
          throw new Error(url.searchParams.get("error_description") || oauthError);
        }

        // 2. Exchange code for session (required for PKCE flow)
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
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
          // Save pending role to user_metadata
          await supabase.auth.updateUser({ data: { role: pendingRole } });
          finalRole = pendingRole;
          localStorage.removeItem("a4ai_pending_role");
        }

        // 5. Upsert profile in profiles table
        try {
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata?.full_name as string) ||
              (user.user_metadata?.name as string) ||
              "New User",
            role: finalRole || "student", // fallback for DB constraint
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          // Non-fatal — profile might already exist or table might not exist yet
          console.debug("Profile upsert skipped:", (profileErr as any)?.message);
        }

        // 6. Clean URL
        window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);

        // 7. Redirect based on role
        if (finalRole && ["student", "teacher", "institute"].includes(finalRole)) {
          navigate(`/${finalRole}/dashboard`, { replace: true });
        } else {
          navigate("/select-role", { replace: true });
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