// src/pages/AssignmentLinkPage.tsx
// Route: /s/:token — the link a teacher shares on WhatsApp for one assignment.
// Link (get_assignment_link) → access code → "Ye aap hi ho?" (verify_access_code) → upload + history.
// No login and no backend: anon RPCs only (docs/upload-flow-api.md §2).
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { portalSupabase as supabase } from "@/lib/supabasePortalClient";
import UploadAttempts, { type UploadTokens } from "@/components/student/UploadAttempts";
import { type LinkInfo, type VerifiedStudent, fmtCountdown, fmtIST, getAssignmentLink, stateMessage,
         verifyAccessCode } from "@/lib/uploadFlow";

const T: UploadTokens = {
  bg: "#fafafa", surface: "#ffffff", border: "#e4e4e7", textPrimary: "#18181b", textSecondary: "#52525b",
  textMuted: "#a1a1aa", accent: "#4F46E5", accentHover: "#4338ca", accentBg: "rgba(79, 70, 229, 0.08)",
  teal: "#0D9488", tealBg: "rgba(13, 148, 136, 0.08)",
};
const CODE_KEY = "a4ai_student_code";

export default function AssignmentLinkPage() {
  const { token = "" } = useParams();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState(() => { try { return localStorage.getItem(CODE_KEY) || ""; } catch { return ""; } });
  const [step, setStep] = useState<"code" | "confirm" | "upload">("code");
  const [who, setWho] = useState<VerifiedStudent | null>(null);
  const [ids, setIds] = useState<{ id: string; institute_id: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [until, setUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getAssignmentLink(token).then(setLink).catch(e => setLoadError(e.message));
  }, [token]);

  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) { setUntil(0); setMsg(""); }
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  async function checkCode() {
    const clean = code.trim().toUpperCase();
    if (clean.length < 6 || busy || until) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await verifyAccessCode(clean);
      if (r.state === "ok" && r.student) {
        setWho(r.student);
        setCode(clean);
        setStep("confirm");
      } else {
        setMsg(stateMessage(r));
        if (r.retry_after_sec) { setUntil(Date.now() + r.retry_after_sec * 1000); setNow(Date.now()); }
      }
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  }

  async function confirm() {
    setBusy(true);
    // ids only build the upload path (the storage policy re-checks it); identity stays the code
    const { data, error } = await supabase.rpc("get_student_by_code", { p_code: code });
    setBusy(false);
    if (error || !data) { setMsg("Code check nahi hua. Dobara try karo."); setStep("code"); return; }
    try { localStorage.setItem(CODE_KEY, code); } catch { /* ignore */ }
    setIds({ id: data.id, institute_id: data.institute_id });
    setStep("upload");
  }

  const asg = link?.assignment;
  const shownMsg = msg.replace("{countdown}", fmtCountdown((until - now) / 1000));

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.textPrimary, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        <div className="rounded-xl border p-4 sm:p-6 space-y-4" style={{ background: T.surface, borderColor: T.border }}>
          {!link && !loadError && <p className="text-sm" style={{ color: T.textMuted }}>Load ho raha hai…</p>}
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}

          {link && (link.state === "not_found" || !asg) && (
            <div className="text-center space-y-2 py-6">
              <p className="text-lg font-semibold">{link.state === "inactive" ? link.title || "Assignment" : "Link nahi mila"}</p>
              <p className="text-sm" style={{ color: T.textSecondary }}>{stateMessage({ state: link.state })}</p>
            </div>
          )}

          {asg && (
            <>
              <div>
                <h1 className="text-lg sm:text-xl font-bold break-words">{asg.title}</h1>
                <p className="text-xs sm:text-sm mt-1" style={{ color: T.textSecondary }}>
                  {asg.batch_name ? `${asg.batch_name} · ` : ""}{asg.max_marks ? `${asg.max_marks} marks · ` : ""}
                  {asg.closes_at ? `Deadline ${fmtIST(asg.closes_at)}` : "Koi deadline nahi"}
                </p>
              </div>
              {!["open", "open_late"].includes(link.state) && (
                <div className="rounded-lg border px-3 py-2 text-sm text-red-600" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                  {stateMessage({ state: link.state, opens_at: asg.opens_at, closes_at: asg.closes_at })}
                </div>
              )}

              {step === "code" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="code">Apna access code daalo</label>
                  <input id="code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={16}
                    onKeyDown={e => { if (e.key === "Enter") checkCode(); }}
                    autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    className="w-full rounded-lg border px-3 py-2.5 text-base tracking-widest font-mono"
                    style={{ borderColor: T.border }} placeholder="e.g. 7KQ2M9XA" />
                  <button onClick={checkCode} disabled={busy || !!until || code.trim().length < 6}
                    className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})` }}>
                    {busy ? "Check ho raha hai…" : "Aage badho"}
                  </button>
                </div>
              )}

              {step === "confirm" && who && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Ye aap hi ho?</p>
                  <div className="rounded-lg border p-3 text-sm space-y-0.5" style={{ borderColor: T.border, background: T.bg }}>
                    <p className="font-semibold">{who.name}</p>
                    <p style={{ color: T.textSecondary }}>
                      {[who.roll_no && `Roll ${who.roll_no}`, who.class_level && `Class ${who.class_level}`,
                        who.section_name || who.batch_name, who.institute_name].filter(Boolean).join(" · ")}
                    </p>
                    {who.email_masked && <p style={{ color: T.textMuted }}>{who.email_masked}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={confirm} disabled={busy} className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium"
                      style={{ background: T.teal }}>Haan, main hi hoon</button>
                    <button onClick={() => { setStep("code"); setWho(null); setCode(""); }}
                      className="flex-1 py-2.5 rounded-lg border text-sm" style={{ borderColor: T.border }}>Nahi, code badlo</button>
                  </div>
                </div>
              )}

              {step === "upload" && ids && (
                <UploadAttempts code={code} assignmentRef={token} student={ids} t={T} />
              )}

              {shownMsg && <div role="status" className="rounded-lg border px-3 py-2 text-sm text-red-600"
                style={{ borderColor: "rgba(239,68,68,0.3)" }}>{shownMsg}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
