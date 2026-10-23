// src/pages/AssignmentLinkPage.tsx
// /s/:token — the link a teacher shares on WhatsApp for one assignment. Served by its own light entry (s.html →
// src/linkMain.tsx); the App's /s/:token route is a fallback. The token comes in as a prop (no router here).
// Link (get_assignment_link) → access code → "Is this you?" (verify_access_code) → upload + history.
// Open link (23, identity_mode "open"): name / roll / class form → open_start → upload + history (this device only).
// No login and no backend: anon RPCs only (docs/upload-flow-api.md §2). The confirmed code is remembered per link.
import React, { Suspense, lazy, useEffect, useState } from "react";
import type { UploadTokens } from "@/components/student/UploadAttempts";
import UploadSkeleton from "@/components/student/UploadSkeleton";
import { type LinkInfo, type VerifiedStudent, fmtCountdown, fmtIST, getAssignmentLink, getStudentIds, openStart,
         stateMessage, verifyAccessCode } from "@/lib/uploadFlow";
import { type OpenSubmitter, cleanCode, cleanName, clearCode, clearSubmitter, loadCode, loadSubmitter, saveCode,
         saveSubmitter } from "@/lib/uploadLink/session";
import { fmtLeft } from "@/lib/uploadLink/time";
import { OfflineBanner } from "@/components/uploadLink/ui";
import { useCountdown } from "@/hooks/useUploadLinkTimers";
import { BLACK_BTN } from "@/lib/uploadLink/styles";


// the upload screen (and its code) loads only after the student confirmed the code
const UploadAttempts = lazy(() => import("@/components/student/UploadAttempts"));

const T: UploadTokens = {
  bg: "#fafafa", surface: "#ffffff", border: "#e4e4e7", textPrimary: "#18181b", textSecondary: "#52525b",
  textMuted: "#a1a1aa", accent: "#111827", accentHover: "#000000", accentBg: "rgba(17, 24, 39, 0.06)",
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

/** First paint: the same blocks and heights as the open-link screen (title, deadline line, code box, button). */
function LinkSkeleton() {
  const bar = (w: string, h: number, extra = "") => (
    <div className={`rounded animate-pulse ${extra}`} style={{ width: w, height: h, background: T.border }} />
  );
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Opening the link" data-testid="link-skeleton">
      <div className="space-y-2">{bar("75%", 26)}{bar("55%", 16)}{bar("35%", 16)}</div>
      <div className="space-y-2">{bar("45%", 18)}{bar("100%", 54, "rounded-lg")}{bar("60%", 14)}{bar("100%", 46, "rounded-lg")}</div>
    </div>
  );
}

export default function AssignmentLinkPage({ token }: { token: string }) {
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
  // open link: this device's submitter + the form
  const [submitter, setSubmitter] = useState<OpenSubmitter | null>(() => loadSubmitter(token));
  const [editing, setEditing] = useState(false);
  const [gName, setGName] = useState(() => submitter?.name || "");
  const [gRoll, setGRoll] = useState(() => submitter?.roll || "");
  const [gCls, setGCls] = useState(() => submitter?.cls || "");

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
    const data = await getStudentIds(c).catch(() => null);
    setBusy(false);
    if (!data) {
      clearCode(token);
      if (remember) setMsg("Couldn't check the code. Try again.");
      setStep("code");
      return;
    }
    if (remember) saveCode(token, c);
    setCode(c);
    setIds({ id: data.id, institute_id: data.institute_id });
    setStep("upload");
  }

  async function startGuest() {
    const details = { name: cleanName(gName), roll: cleanName(gRoll), cls: cleanName(gCls) };
    if (details.name.length < 2 || details.name.length > 60) { setMsg(stateMessage({ state: "invalid_name" })); return; }
    if (busy || until) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await openStart(token, details, submitter?.key);
      if (r.state === "ok" && r.submitter_key && r.upload_prefix) {
        const next = { key: r.submitter_key, prefix: r.upload_prefix, ...details };
        saveSubmitter(token, next);
        setSubmitter(next);
        setEditing(false);
      } else {
        setMsg(stateMessage(r));
        if (r.retry_after_sec) { setUntil(Date.now() + r.retry_after_sec * 1000); setNow(Date.now()); }
      }
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  }

  /** "Not you?" on a shared phone, or the server no longer knows this device's key: a fresh form. */
  function startOver(lost = false) {
    clearSubmitter(token);
    setSubmitter(null);
    setEditing(false);
    setGName(""); setGRoll(""); setGCls("");
    setMsg(lost ? stateMessage({ state: "invalid_submitter" }) : "");
  }

  function changeCode() {
    clearCode(token);
    setCode("");
    setWho(null);
    setIds(null);
    setStep("code");
  }

  const asg = link?.assignment;
  const isOpen = asg?.identity_mode === "open";
  const closesAt = asg?.closes_at ? new Date(asg.closes_at).getTime() : null;
  const opensAt = asg?.opens_at ? new Date(asg.opens_at).getTime() : null;
  const leftToClose = useCountdown(link?.state === "open" ? closesAt : null, load);
  const leftToOpen = useCountdown(link?.state === "not_open" ? opensAt : null, load);
  const shownMsg = msg.replace("{countdown}", fmtCountdown((until - now) / 1000));

  let body: React.ReactNode;
  if (!link && !loadError) body = <LinkSkeleton />;
  else if (loadError && !link) body = (
    <Friendly icon="📶" title="Couldn't load the link">
      <p>{loadError}</p>
      <button onClick={load} className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium ${BLACK_BTN}`}>Try again</button>
    </Friendly>
  );
  else if (!link || link.state === "not_found" || (!asg && link.state !== "inactive")) body = (
    <Friendly icon="🔍" title="This link doesn't work">
      Check that the whole link was copied. If it still doesn't open, <b>talk to your teacher</b>.
    </Friendly>
  );
  else if (link.state === "inactive") body = (
    <Friendly icon="⏸️" title={link.title || "Uploads are closed"}>Your teacher has closed uploads for now. <b>Talk to your teacher.</b></Friendly>
  );
  else if (link.state === "not_open" && asg) body = (
    <Friendly icon="🕒" title={asg.title}>
      <p>Uploads haven't opened yet.{asg.opens_at ? <> They open on <b>{fmtIST(asg.opens_at)}</b>.</> : null}</p>
      {opensAt && <p className="mt-2 font-semibold" data-testid="countdown">Opens in {fmtLeft(leftToOpen)}</p>}
    </Friendly>
  );
  else if (link.state === "closed" && asg) body = (
    <Friendly icon="⌛" title={asg.title}>
      Uploads closed{asg.closes_at ? <> on <b>{fmtIST(asg.closes_at)}</b></> : null}. Late uploads aren't allowed — <b>talk to your teacher</b>.
    </Friendly>
  );
  else if (asg) body = (
    <>
      <div data-testid="link-header">
        <h1 className="text-lg sm:text-xl font-bold break-words">{asg.title}</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: T.textSecondary }}>
          {asg.batch_name ? `${asg.batch_name} · ` : ""}{asg.max_marks ? `${asg.max_marks} marks · ` : ""}
          {asg.closes_at ? `Deadline ${fmtIST(asg.closes_at)}` : "No deadline"}
        </p>
        {link.state === "open" && closesAt && (
          <p className="text-xs mt-1 font-semibold tabular-nums" style={{ color: leftToClose < 3_600_000 ? "#DC2626" : T.teal }} data-testid="deadline-countdown">
            ⏳ {fmtLeft(leftToClose)} left
          </p>
        )}
        {link.state === "open_late" && <p className="text-xs mt-1 font-semibold text-amber-600">The deadline has passed — uploads will be marked late.</p>}
      </div>

      {isOpen && (!submitter || editing) && (
        <form className="space-y-3" data-testid="guest-step" onSubmit={e => { e.preventDefault(); startGuest(); }}>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="g-name">Full name</label>
            <input id="g-name" value={gName} onChange={e => setGName(e.target.value)} required minLength={2} maxLength={60}
              autoComplete="name" className="w-full rounded-lg border px-3 py-3 text-base" style={{ borderColor: T.border }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="g-roll">Roll number <span style={{ color: T.textMuted }}>(optional)</span></label>
              <input id="g-roll" value={gRoll} onChange={e => setGRoll(e.target.value)} maxLength={30} autoComplete="off"
                className="w-full rounded-lg border px-3 py-3 text-base" style={{ borderColor: T.border }} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="g-class">Class / section <span style={{ color: T.textMuted }}>(optional)</span></label>
              <input id="g-class" value={gCls} onChange={e => setGCls(e.target.value)} maxLength={60} autoComplete="off"
                className="w-full rounded-lg border px-3 py-3 text-base" style={{ borderColor: T.border }} />
            </div>
          </div>
          <button type="submit" disabled={busy || !!until || cleanName(gName).length < 2} data-testid="guest-submit"
            className={`w-full py-3 rounded-lg text-sm font-semibold ${BLACK_BTN}`}>
            {busy ? "Please wait…" : until ? `Wait ${fmtCountdown((until - now) / 1000)}` : "Continue"}
          </button>
        </form>
      )}

      {isOpen && submitter && !editing && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.bg }} data-testid="guest-header">
            <span style={{ color: T.textSecondary }}>
              Submitting as <b>{submitter.name}</b>{submitter.roll ? ` · Roll ${submitter.roll}` : ""}{submitter.cls ? ` · ${submitter.cls}` : ""}
            </span>
            <span className="flex gap-3">
              <button onClick={() => setEditing(true)} className="font-semibold underline" style={{ color: T.accent }}>Change details</button>
              <button onClick={() => startOver()} className="font-semibold underline" style={{ color: T.accent }}>Not you? Start again</button>
            </span>
          </div>
          <Suspense fallback={<UploadSkeleton t={T} />}>
            <UploadAttempts assignmentRef={token} t={T}
              guest={{ token, submitter, onLost: () => startOver(true) }} />
          </Suspense>
        </>
      )}

      {!isOpen && step === "code" && (
        <form className="space-y-2" data-testid="code-step" onSubmit={e => { e.preventDefault(); checkCode(); }}>
          <label className="text-sm font-medium" htmlFor="code">Enter your access code</label>
          <input id="code" value={code} onChange={e => setCode(cleanCode(e.target.value))}
            onPaste={e => { e.preventDefault(); setCode(cleanCode(e.clipboardData.getData("text"))); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
            className="w-full rounded-lg border px-3 py-3 text-xl text-center tracking-[0.3em] font-mono"
            style={{ borderColor: T.border }} placeholder="7KQ2M9" aria-describedby="code-hint" />
          {/* live codes are 6 characters; the "Generate codes" RPC (07) makes 8 — both work (21 also fixes O/0, I/1) */}
          <p id="code-hint" className="text-xs" style={{ color: T.textMuted }}>6 or 8 letters and numbers, from your teacher.</p>
          <button type="submit" disabled={busy || !!until || code.length < 6} data-testid="code-submit"
            className={`w-full py-3 rounded-lg text-sm font-semibold ${BLACK_BTN}`}>
            {busy ? "Checking…" : until ? `Wait ${fmtCountdown((until - now) / 1000)}` : "Continue"}
          </button>
        </form>
      )}

      {!isOpen && step === "confirm" && who && (
        <div className="space-y-3" data-testid="confirm-step">
          <p className="text-base font-semibold">
            Are you <b>{who.name}</b>{who.class_level ? <>, Class {who.class_level}</> : null}{who.section_name || who.batch_name ? <> ({who.section_name || who.batch_name})</> : null}?
          </p>
          <div className="rounded-lg border p-3 text-sm space-y-0.5" style={{ borderColor: T.border, background: T.bg }}>
            <p style={{ color: T.textSecondary }}>{[who.roll_no && `Roll ${who.roll_no}`, who.institute_name].filter(Boolean).join(" · ")}</p>
            {who.email_masked && <p style={{ color: T.textMuted }}>{who.email_masked}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openWithCode(code, true)} disabled={busy} className={`flex-1 py-3 rounded-lg text-sm font-semibold ${BLACK_BTN}`}>
              Yes, that's me</button>
            <button onClick={changeCode} className="flex-1 py-3 rounded-lg border text-sm active:scale-95 transition-all" style={{ borderColor: T.border }}>No, that's not me</button>
          </div>
        </div>
      )}

      {!isOpen && step === "upload" && ids && (
        <>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: T.bg }}>
            <span style={{ color: T.textSecondary }}>Code: <b className="font-mono">{code}</b></span>
            <button onClick={changeCode} className="font-semibold underline" style={{ color: T.accent }} data-testid="change-code">
              Log out / change code
            </button>
          </div>
          <Suspense fallback={<UploadSkeleton t={T} />}>
            <UploadAttempts code={code} assignmentRef={token} student={ids} t={T} />
          </Suspense>
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
