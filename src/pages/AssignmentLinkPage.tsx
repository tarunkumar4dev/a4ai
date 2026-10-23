// src/pages/AssignmentLinkPage.tsx
// Route: /s/:token — the link a teacher shares on WhatsApp for one assignment.
// Link (get_assignment_link) → access code → "Ye aap hi ho?" (verify_access_code) → upload + history.
// No login and no backend: anon RPCs only (docs/upload-flow-api.md §2). The confirmed code is remembered per link.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { portalSupabase as supabase } from "@/lib/supabasePortalClient";
import UploadAttempts, { type UploadTokens } from "@/components/student/UploadAttempts";
import { type LinkInfo, type VerifiedStudent, fmtCountdown, fmtIST, getAssignmentLink, stateMessage,
         verifyAccessCode } from "@/lib/uploadFlow";
import { cleanCode, clearCode, loadCode, saveCode } from "@/lib/uploadLink/session";
import { fmtLeft } from "@/lib/uploadLink/time";
import { OfflineBanner } from "@/components/uploadLink/ui";
import { useCountdown } from "@/hooks/useUploadLinkTimers";


const T: UploadTokens = {
  bg: "#fafafa", surface: "#ffffff", border: "#e4e4e7", textPrimary: "#18181b", textSecondary: "#52525b",
  textMuted: "#a1a1aa", accent: "#4F46E5", accentHover: "#4338ca", accentBg: "rgba(79, 70, 229, 0.08)",
  teal: "#0D9488", tealBg: "rgba(13, 148, 136, 0.08)",
};
const PORTAL_CODE_KEY = "a4ai_student_code";        // the /student portal's remembered code (prefill only)

function Friendly({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center space-y-2 py-8" data-testid="link-state">
      <div className="text-5xl" aria-hidden>{icon}</div>
      <p className="text-lg font-bold">{title}</p>
      <div className="text-sm" style={{ color: T.textSecondary }}>{children}</div>
    </div>
  );
}

export default function AssignmentLinkPage() {
  const { token = "" } = useParams();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState(() => {
    try { return cleanCode(loadCode(token) || localStorage.getItem(PORTAL_CODE_KEY) || ""); } catch { return ""; }
  });
  const [step, setStep] = useState<"code" | "confirm" | "upload">("code");
  const [who, setWho] = useState<VerifiedStudent | null>(null);
  const [ids, setIds] = useState<{ id: string; institute_id: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [until, setUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = () => {
    setLoadError("");
    getAssignmentLink(token).then(setLink).catch(e => setLoadError(e.message));
  };
  useEffect(load, [token]);

  // a code confirmed earlier on this link → straight to the upload screen
  useEffect(() => {
    const saved = loadCode(token);
    if (saved) openWithCode(saved, false);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) { setUntil(0); setMsg(""); }
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  async function checkCode() {
    const clean = cleanCode(code);
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

  async function openWithCode(c: string, remember: boolean) {
    setBusy(true);
    // ids only build the upload path (the storage policy re-checks it); identity stays the code
    const { data, error } = await supabase.rpc("get_student_by_code", { p_code: c });
    setBusy(false);
    if (error || !data) {
      clearCode(token);
      if (remember) setMsg("Code check nahi hua. Dobara try karo.");
      setStep("code");
      return;
    }
    if (remember) saveCode(token, c);
    setCode(c);
    setIds({ id: data.id, institute_id: data.institute_id });
    setStep("upload");
  }

  function changeCode() {
    clearCode(token);
    setCode("");
    setWho(null);
    setIds(null);
    setStep("code");
  }

  const asg = link?.assignment;
  const closesAt = asg?.closes_at ? new Date(asg.closes_at).getTime() : null;
  const opensAt = asg?.opens_at ? new Date(asg.opens_at).getTime() : null;
  const leftToClose = useCountdown(link?.state === "open" ? closesAt : null, load);
  const leftToOpen = useCountdown(link?.state === "not_open" ? opensAt : null, load);
  const shownMsg = msg.replace("{countdown}", fmtCountdown((until - now) / 1000));

  let body: React.ReactNode;
  if (!link && !loadError) body = <p className="text-sm py-6 text-center" style={{ color: T.textMuted }}>Link khul raha hai…</p>;
  else if (loadError && !link) body = (
    <Friendly icon="📶" title="Link load nahi hua">
      <p>{loadError}</p>
      <button onClick={load} className="mt-3 rounded-lg px-4 py-2 text-white text-sm font-medium" style={{ background: T.accent }}>Dobara try karo</button>
    </Friendly>
  );
  else if (!link || link.state === "not_found" || (!asg && link.state !== "inactive")) body = (
    <Friendly icon="🔍" title="Ye link sahi nahi hai">
      Link poora copy hua hai ya nahi, check karo. Phir bhi na khule to <b>teacher se baat karo</b>.
    </Friendly>
  );
  else if (link.state === "inactive") body = (
    <Friendly icon="⏸️" title={link.title || "Upload band hai"}>Teacher ne abhi ye upload band kiya hua hai. <b>Teacher se baat karo.</b></Friendly>
  );
  else if (link.state === "not_open" && asg) body = (
    <Friendly icon="🕒" title={asg.title}>
      <p>Upload abhi shuru nahi hua. {asg.opens_at ? <>Ye <b>{fmtIST(asg.opens_at)}</b> ko khulega.</> : null}</p>
      {opensAt && <p className="mt-2 font-semibold" data-testid="countdown">Khulne mein: {fmtLeft(leftToOpen)}</p>}
    </Friendly>
  );
  else if (link.state === "closed" && asg) body = (
    <Friendly icon="⌛" title={asg.title}>
      Upload ka time {asg.closes_at ? <b>{fmtIST(asg.closes_at)}</b> : null} ko khatam ho gaya. Late upload allowed nahi hai — <b>teacher se baat karo</b>.
    </Friendly>
  );
  else if (asg) body = (
    <>
      <div data-testid="link-header">
        <h1 className="text-lg sm:text-xl font-bold break-words">{asg.title}</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: T.textSecondary }}>
          {asg.batch_name ? `${asg.batch_name} · ` : ""}{asg.max_marks ? `${asg.max_marks} marks · ` : ""}
          {asg.closes_at ? `Deadline ${fmtIST(asg.closes_at)}` : "Koi deadline nahi"}
        </p>
        {link.state === "open" && closesAt && (
          <p className="text-xs mt-1 font-semibold" style={{ color: leftToClose < 3_600_000 ? "#DC2626" : T.teal }} data-testid="deadline-countdown">
            ⏳ Time bacha: {fmtLeft(leftToClose)}
          </p>
        )}
        {link.state === "open_late" && <p className="text-xs mt-1 font-semibold text-amber-600">Deadline nikal gayi — ab upload late mark hoga.</p>}
      </div>

      {step === "code" && (
        <form className="space-y-2" data-testid="code-step" onSubmit={e => { e.preventDefault(); checkCode(); }}>
          <label className="text-sm font-medium" htmlFor="code">Apna access code daalo</label>
          <input id="code" value={code} onChange={e => setCode(cleanCode(e.target.value))}
            onPaste={e => { e.preventDefault(); setCode(cleanCode(e.clipboardData.getData("text"))); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
            className="w-full rounded-lg border px-3 py-3 text-xl text-center tracking-[0.3em] font-mono"
            style={{ borderColor: T.border }} placeholder="7KQ2M9" aria-describedby="code-hint" />
          {/* live codes are 6 characters; the "Generate codes" RPC (07) makes 8 — both work (21 also fixes O/0, I/1) */}
          <p id="code-hint" className="text-xs" style={{ color: T.textMuted }}>6 or 8 letters and numbers, from your teacher.</p>
          <button type="submit" disabled={busy || !!until || code.length < 6} data-testid="code-submit"
            className="w-full py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})` }}>
            {busy ? "Check ho raha hai…" : until ? `Ruko… ${fmtCountdown((until - now) / 1000)}` : "Aage badho"}
          </button>
        </form>
      )}

      {step === "confirm" && who && (
        <div className="space-y-3" data-testid="confirm-step">
          <p className="text-base font-semibold">
            Kya aap <b>{who.name}</b>{who.class_level ? <>, Class {who.class_level}</> : null}{who.section_name || who.batch_name ? <> ({who.section_name || who.batch_name})</> : null} ho?
          </p>
          <div className="rounded-lg border p-3 text-sm space-y-0.5" style={{ borderColor: T.border, background: T.bg }}>
            <p style={{ color: T.textSecondary }}>{[who.roll_no && `Roll ${who.roll_no}`, who.institute_name].filter(Boolean).join(" · ")}</p>
            {who.email_masked && <p style={{ color: T.textMuted }}>{who.email_masked}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openWithCode(code, true)} disabled={busy} className="flex-1 py-3 rounded-lg text-white text-sm font-semibold"
              style={{ background: T.teal }}>Haan, main hi hoon</button>
            <button onClick={changeCode} className="flex-1 py-3 rounded-lg border text-sm" style={{ borderColor: T.border }}>Nahi, ye main nahi</button>
          </div>
        </div>
      )}

      {step === "upload" && ids && (
        <>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: T.bg }}>
            <span style={{ color: T.textSecondary }}>Code: <b className="font-mono">{code}</b></span>
            <button onClick={changeCode} className="font-semibold underline" style={{ color: T.accent }} data-testid="change-code">
              Logout / code badlo
            </button>
          </div>
          <UploadAttempts code={code} assignmentRef={token} student={ids} t={T} />
        </>
      )}

      {shownMsg && <div role="status" className="rounded-lg border px-3 py-2 text-sm text-red-600" data-testid="code-message"
        style={{ borderColor: "rgba(239,68,68,0.3)" }}>{shownMsg}</div>}
    </>
  );

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.textPrimary, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <OfflineBanner />
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        <div className="rounded-xl border p-4 sm:p-6 space-y-4" style={{ background: T.surface, borderColor: T.border }}>
          {body}
        </div>
      </div>
    </div>
  );
}
