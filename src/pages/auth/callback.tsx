// src/pages/callback.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

/** Read ?code / ?next / ?error from search or hash (some hosts append after #) */
function readAuthParams() {
  const url = new URL(window.location.href);
  let params = new URLSearchParams(url.search);

  let code = params.get("code");
  let next = params.get("next");
  let err =
    params.get("error_description") ||
    params.get("error") ||
    params.get("error_code");

  if (!code || (!next && !err)) {
    const hash = window.location.hash || "";
    const qIndex = hash.indexOf("?");
    if (qIndex !== -1) {
      const hp = new URLSearchParams(hash.slice(qIndex + 1));
      code = code || hp.get("code");
      next = next || hp.get("next");
      err =
        err ||
        hp.get("error_description") ||
        hp.get("error") ||
        hp.get("error_code");
    }
  }

  // decode if URL-encoded
  try {
    if (err) err = decodeURIComponent(err);
    if (next) next = decodeURIComponent(next);
  } catch {
    // ignore decode issues; use raw values
  }

  return { url, code, next, err };
}

/** Allow only same-origin internal paths to avoid open-redirects */
function sanitizeNext(next?: string | null) {
  if (!next) return "/dashboard";
  try {
    const asURL = new URL(next, window.location.origin);
    if (asURL.origin !== window.location.origin) return "/dashboard";
    return `${asURL.pathname}${asURL.search}${asURL.hash || ""}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default function Callback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { url, code, next, err } = readAuthParams();
        const safeNext = sanitizeNext(next);

        if (err) throw new Error(err);

        if (!code) {
          // No code in URL → either already signed in or go to /login
          const { data: { session } } = await supabase.auth.getSession();
          navigate(session ? safeNext : "/login", { replace: true });
          return;
        }

        // Exchange PKCE code for a session
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(url.toString());
        if (exchangeError) throw exchangeError;

        // Fetch current user (post-exchange)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("No user found after authentication");

        // Idempotent profile upsert (works even without DB trigger)
        const full_name =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null;

        const avatar_url =
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null;

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name,
              avatar_url,
              role: "student",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select()
          .single();
        if (profileError) throw profileError;

        navigate(safeNext, { replace: true });
      } catch (e: any) {
        console.error("OAuth callback error:", e);
        toast({
          title: "Authentication failed",
          description: e?.message ?? "Something went wrong while signing you in.",
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
