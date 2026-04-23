// src/pages/institute/JoinInstitutePage.tsx
// Clean page where teachers enter a join code to join an institute

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const styles = `
  .join-root {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .join-card {
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
  .dark .join-card {
    background: rgb(24,24,27);
    border-color: rgba(255,255,255,0.08);
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }
  .code-input {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-align: center;
    text-transform: lowercase;
    background: rgb(250,250,250);
    border: 2px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    padding: 16px 20px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    color: #111;
  }
  .code-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
    background: white;
  }
  .code-input::placeholder {
    color: #d1d5db;
    letter-spacing: 0.25em;
    font-weight: 500;
  }
  .dark .code-input {
    background: rgb(30,30,35);
    border-color: rgba(255,255,255,0.1);
    color: #f0f0f0;
  }
  .dark .code-input:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 4px rgba(96,165,250,0.15);
  }
  .join-btn {
    background: #111;
    color: white;
    font-weight: 600;
    font-size: 14px;
    padding: 12px 24px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .join-btn:hover { background: #333; }
  .join-btn:active { transform: scale(0.98); }
  .join-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .dark .join-btn { background: #f0f0f0; color: #111; }
  .dark .join-btn:hover { background: #ddd; }
  .back-link {
    font-size: 13px;
    font-weight: 500;
    color: #71717a;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .back-link:hover { color: #3b82f6; }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .anim-pop { animation: scaleIn 0.35s ease-out forwards; }
`;

export default function JoinInstitutePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed || !user) return;

    setJoining(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("join_institute_by_code", {
        p_join_code: trimmed,
      });

      if (rpcError) throw rpcError;

      const result = typeof data === "string" ? JSON.parse(data) : data;

      if (result.success) {
        setSuccess(result.institute_name);
        toast.success(`Joined ${result.institute_name}!`);
        setTimeout(() => navigate("/teacher/dashboard"), 2000);
      } else {
        setError(result.error || "Invalid code");
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
    setJoining(false);
  };

  return (
    <div className="join-root">
      <style>{styles}</style>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-4">
        
        {/* Back link */}
        <div className="w-full max-w-sm mb-6">
          <button className="back-link" onClick={() => navigate("/teacher/dashboard")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Dashboard
          </button>
        </div>

        <div className="join-card p-8 sm:p-10 max-w-sm w-full anim-pop">
          
          {!success ? (
            <>
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              </div>

              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 text-center mb-1">
                Join an Institute
              </h1>
              <p className="text-[13px] text-zinc-500 text-center mb-6">
                Enter the 8-character code your institute admin shared with you.
              </p>

              {/* Code input */}
              <div className="mb-4">
                <input
                  className="code-input"
                  placeholder="abc12def"
                  maxLength={8}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  autoFocus
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                  <p className="text-[12px] text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}

              {/* Join button */}
              <button
                className="join-btn"
                onClick={handleJoin}
                disabled={joining || code.trim().length < 4}
              >
                {joining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Institute
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-400 text-center mt-4">
                Don't have a code? Ask your institute admin for one.
              </p>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                You're in!
              </h2>
              <p className="text-[13px] text-zinc-500 mb-1">
                Successfully joined <strong>{success}</strong>
              </p>
              <p className="text-[11px] text-zinc-400">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}