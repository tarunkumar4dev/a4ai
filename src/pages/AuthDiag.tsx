// src/pages/AuthDiag.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = { k: string; v: string | boolean | null | undefined };

function mask(s?: string | null) {
  if (!s) return String(s);
  if (s.length <= 8) return "••" + s.slice(-2);
  return s.slice(0, 4) + "•••" + s.slice(-4);
}

export default function AuthDiag() {
  const [sessionJson, setSessionJson] = useState<any>(null);
  const [userJson, setUserJson] = useState<any>(null);
  const [exchangeResult, setExchangeResult] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const rows: Row[] = useMemo(
    () => [
      { k: "location.origin", v: typeof window !== "undefined" ? window.location.origin : "no-window" },
      { k: "location.href", v: typeof window !== "undefined" ? window.location.href : "no-window" },
      { k: "VITE_SUPABASE_URL", v: import.meta.env.VITE_SUPABASE_URL },
      { k: "VITE_SITE_URL", v: import.meta.env.VITE_SITE_URL },
      { k: "Auth Code in URL?", v: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("code") },
      { k: "Detect Session In URL (client)", v: "via supabase client config" },
    ],
    []
  );

  useEffect(() => {
    (async () => {
      try {
        // 1) What session exists right now?
        const { data: { session } } = await supabase.auth.getSession();
        setSessionJson(session);

        // 2) If code present, attempt exchange explicitly (diagnostic)
        const url = typeof window !== "undefined" ? window.location.href : "";
        if (url && new URL(url).searchParams.get("code")) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            setErrorMsg("exchangeCodeForSession ERROR: " + error.message);
          } else {
            setExchangeResult("exchangeCodeForSession OK");
          }
        }

        // 3) What user now?
        const { data: { user } } = await supabase.auth.getUser();
        setUserJson(user);
      } catch (e: any) {
        setErrorMsg("Diag exception: " + (e?.message || String(e)));
      }
    })();
  }, []);

  const signIn = async () => {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/diag`
        : (import.meta.env.VITE_SITE_URL || "") + "/auth/diag";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account", access_type: "offline" } },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h2>Auth Diag</h2>
      <p style={{ color: "gray" }}>Minimal, single-page diagnostic for Supabase OAuth.</p>

      <h3>Env & URL</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 900 }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td style={{ borderBottom: "1px solid #ddd", padding: 6, fontWeight: 600, width: 260 }}>{r.k}</td>
              <td style={{ borderBottom: "1px solid #ddd", padding: 6, wordBreak: "break-all" }}>
                {r.k.includes("ANON_KEY") ? mask(String(r.v)) : String(r.v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <button onClick={signIn} style={{ padding: "8px 14px", marginRight: 8 }}>Sign in with Google → /auth/diag</button>
        <button onClick={signOut} style={{ padding: "8px 14px" }}>Sign out</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Session (before/after exchange)</h3>
      <pre style={{ background: "#111", color: "#0f0", padding: 12, borderRadius: 8, overflow: "auto" }}>
        {JSON.stringify(sessionJson, null, 2)}
      </pre>

      <h3>User</h3>
      <pre style={{ background: "#111", color: "#0ff", padding: 12, borderRadius: 8, overflow: "auto" }}>
        {JSON.stringify(userJson, null, 2)}
      </pre>

      <h3>Status</h3>
      <p><b>exchange result:</b> {exchangeResult || "(not run or pending)"}</p>
      <p style={{ color: "crimson" }}><b>error:</b> {errorMsg || "(none)"}</p>
    </div>
  );
}
