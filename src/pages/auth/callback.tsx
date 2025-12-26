// src/pages/AuthCallback.tsx
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasRun = useRef(false);
  const location = useLocation();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleAuthCallback = async () => {
      try {
        const url = new URL(window.location.href);
        
        // Check for OAuth errors
        const oauthError = url.searchParams.get("error");
        const oauthErrorDescription = url.searchParams.get("error_description");
        if (oauthError) {
          throw new Error(oauthErrorDescription || oauthError);
        }

        // Exchange code for session if present
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchangeError) throw exchangeError;
        }

        // Get user with retry logic
        const user = await getUserWithRetry();
        if (!user) throw new Error("No user after OAuth exchange");

        // Create or update user profile
        await upsertUserProfile(user);

        // Navigate to destination
        await navigateAfterAuth();
        
      } catch (error: any) {
        handleAuthError(error);
      }
    };

    const getUserWithRetry = async () => {
      let { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!userData?.user) {
        // Retry once after short delay
        await new Promise((resolve) => setTimeout(resolve, 250));
        const retry = await supabase.auth.getUser();
        if (retry.error) throw retry.error;
        return retry.data?.user;
      }

      return userData.user;
    };

    const upsertUserProfile = async (user: any) => {
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
      } catch (profileError) {
        // Non-fatal error - profile might already exist
        console.debug("Profile upsert skipped:", (profileError as any)?.message);
      }
    };

    const navigateAfterAuth = async () => {
      const next = new URLSearchParams(location.search).get("next") || "/dashboard";
      
      // Clean URL before navigation
      window.history.replaceState(
        {}, 
        "", 
        `${window.location.origin}/auth/callback`
      );
      
      navigate(next, { 
        replace: true, 
        state: { from: "oauth-callback" } 
      });
    };

    const handleAuthError = (error: any) => {
      console.error("OAuth callback error:", error);
      
      toast({
        title: "Sign-in failed",
        description: error?.message || "Authentication error",
        variant: "destructive",
      });
      
      navigate("/login", {
        replace: true,
        state: { 
          error: error?.message || "Authentication error" 
        },
      });
    };

    handleAuthCallback();
  }, [location.search, navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-gray-500 mt-2">
          Please wait while we verify your session
        </p>
      </div>
    </div>
  );
}