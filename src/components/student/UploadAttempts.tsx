// src/components/student/UploadAttempts.tsx
// Upload an answer copy (several photos / PDFs, one attempt) + the attempt history, for one assignment.
// Used by the portal's assignment page (/student) and the shared link page (/s/:token).
// Every call is an anon RPC keyed by the access code (src/lib/uploadFlow.ts); nothing here trusts the browser
// for identity — the ids are only used to build the upload path, which the storage policy re-checks.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Attempt, type CreateResult, type LinkInfo, type PreparedPage, STATUS_TEXT, attemptKey, clearAttemptKey,
  createSubmission, fmtCountdown, fmtIST, getAssignmentLink, mySubmissions, preparePage, sha256Hex, stateMessage,
  uploadPage,
} from "@/lib/uploadFlow";

export type UploadTokens = {
  bg: string; surface: string; border: string; textPrimary: string; textSecondary: string; textMuted: string;
  accent: string; accentHover: string; accentBg: string; teal: string; tealBg: string;
};

type Page = {
  id: string;
  name: string;
  state: "preparing" | "ready" | "uploading" | "uploaded" | "error";
  prepared?: PreparedPage;
  sha256?: string;
  path?: string;           // kept after a successful upload, so a retry doesn't upload it again
  error?: string;
};

type Notice = { text: string; tone: "error" | "ok" | "info"; until?: number };

const POLL_MS = 60_000;

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export default function UploadAttempts({ code, assignmentRef, student, t, onChange }: {
  code: string;
  assignmentRef: string;                              // link token or assignment id
  student: { id: string; institute_id: string };
  t: UploadTokens;
  onChange?: () => void;
}) {
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openResult, setOpenResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const now = useNow(!!notice?.until);

  const asg = link?.assignment;
  const assignmentId = asg?.id;

  const refresh = useCallback(async () => {
    try {
      const l = await getAssignmentLink(assignmentRef, code);
      setLink(l);
      if (l.student?.state === "locked") {
        setNotice({ text: stateMessage(l.student), tone: "error", until: Date.now() + (l.student.retry_after_sec || 60) * 1000 });
      }
      const id = l.assignment?.id;
      if (!id || l.student?.state !== "ok") return;
      const h = await mySubmissions(code, id);
      if (h.state === "ok") {
        setAttempts(h.attempts || []);
        setAttemptsLeft(h.attempts_left ?? null);
      } else if (h.state === "locked") {
        setNotice({ text: stateMessage(h), tone: "error", until: Date.now() + (h.retry_after_sec || 60) * 1000 });
      }
    } catch (e: any) {
      setNotice({ text: e.message, tone: "error" });
    }
  }, [assignmentRef, code]);

  // Anon can't use Realtime: poll every 60 s and when the tab comes back
  useEffect(() => {
    refresh();
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(id); window.removeEventListener("focus", tick); };
  }, [refresh]);

  // countdown finished → the message goes away and the student can try again
  useEffect(() => {
    if (notice?.until && now >= notice.until) {
      setNotice(null);
      refresh();
    }
  }, [now, notice, refresh]);

  const linkClosed = link && !["open", "open_late"].includes(link.state);
  // locked → shown as the countdown notice below; the other states can't be fixed by waiting
  const studentBlocked = link?.student && !["ok", "locked"].includes(link.student.state);
  const noAttemptsLeft = attemptsLeft !== null && attemptsLeft <= 0;
  const locked = !!notice?.until && now < notice.until;
  const canUpload = !!asg && !linkClosed && link?.student?.state === "ok" && !noAttemptsLeft;

  const accept = useMemo(() => {
    const m = asg?.allowed_mimes || [];
    // iPhone HEIC is turned into JPEG in the browser, so it's fine whenever JPEG is
    return [...m, ...(m.includes("image/jpeg") ? ["image/heic", "image/heif", ".heic", ".heif"] : [])].join(",");
  }, [asg]);

  async function addFiles(list: FileList | null) {
    if (!list || !asg) return;
    const files = Array.from(list);
    const room = asg.max_pages - pages.length;
    if (files.length > room) {
      setNotice({ text: `Is assignment mein max ${asg.max_pages} pages/files allowed hain.`, tone: "error" });
    }
    const added: Page[] = files.slice(0, Math.max(room, 0)).map(f => ({ id: crypto.randomUUID(), name: f.name, state: "preparing" }));
    setPages(p => [...p, ...added]);
    await Promise.all(added.map(async (pg, i) => {
      const file = files[i];
      try {
        const prepared = await preparePage(file, asg.allowed_mimes, asg.max_mb, pages.length + i + 1);
        const sha256 = await sha256Hex(prepared.blob);
        setPages(p => p.map(x => x.id === pg.id ? { ...x, state: "ready", prepared, sha256 } : x));
      } catch (e: any) {
        setPages(p => p.map(x => x.id === pg.id ? { ...x, state: "error", error: e.message } : x));
      }
    }));
  }

  function move(i: number, d: -1 | 1) {
    setPages(p => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function showResult(r: CreateResult) {
    const until = r.retry_after_sec ? Date.now() + r.retry_after_sec * 1000 : undefined;
    setNotice({ text: stateMessage(r), tone: "error", until });
  }

  async function submit() {
    if (!asg || !assignmentId || busy) return;
    if (pages.length === 0) { setNotice({ text: "Pehle copy ke pages chuno.", tone: "error" }); return; }
    if (pages.some(p => p.state === "preparing")) { setNotice({ text: "Photos tayyar ho rahi hain, ek second…", tone: "info" }); return; }
    if (pages.some(p => p.state === "error")) { setNotice({ text: "Laal wale pages hata do ya badal do, phir Submit karo.", tone: "error" }); return; }
    setBusy(true);
    setNotice(null);
    setWarnings([]);
    const key = attemptKey(assignmentId);       // same key on every retry of this attempt
    try {
      const uploaded: { storage_path: string; mime: string; size: number; sha256: string; page_order: number }[] = [];
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i];
        let path = pg.path;
        if (!path) {
          setPages(p => p.map(x => x.id === pg.id ? { ...x, state: "uploading" } : x));
          try {
            path = await uploadPage({ institute_id: student.institute_id, assignment_id: assignmentId, student_id: student.id },
                                    pg.prepared!);
          } catch (e: any) {
            setPages(p => p.map(x => x.id === pg.id ? { ...x, state: "error", error: e.message } : x));
            throw e;
          }
          const done = path;
          setPages(p => p.map(x => x.id === pg.id ? { ...x, state: "uploaded", path: done } : x));
        }
        uploaded.push({ storage_path: path, mime: pg.prepared!.mime, size: pg.prepared!.size, sha256: pg.sha256!, page_order: i + 1 });
      }
      const r = await createSubmission(code, assignmentId, key, uploaded);
      if (r.state === "created" || r.state === "replayed") {
        clearAttemptKey(assignmentId);
        setPages([]);
        setWarnings((r.warnings || []).map(w => w.message));
        setNotice({ text: `✅ ${r.submission?.label || "Upload"} submit ho gaya. ${STATUS_TEXT[r.submission?.status || ""] || ""}`, tone: "ok" });
        await refresh();
        onChange?.();
      } else if (r.state === "invalid_files") {
        const byIndex = new Map((r.errors || []).map(e => [e.index, e.message]));
        // a file the server refused is re-uploaded under a new name on the next try
        setPages(p => p.map((x, i) => byIndex.has(i + 1) ? { ...x, state: "error", error: byIndex.get(i + 1), path: undefined } : x));
        setNotice({ text: (r.errors || []).map(e => e.message).join(" "), tone: "error" });
      } else {
        showResult(r);
        if (["max_attempts", "closed", "inactive", "not_found"].includes(r.state)) refresh();
      }
    } catch (e: any) {
      setNotice({ text: e.message || "Upload nahi hua. Dobara Submit dabao.", tone: "error" });
    }
    setBusy(false);
  }

  const noticeText = notice ? notice.text.replace("{countdown}", fmtCountdown(((notice.until || now) - now) / 1000)) : "";
  const toneStyle = (tone: Notice["tone"]) => tone === "ok"
    ? { background: t.tealBg, color: t.teal, borderColor: `${t.teal}30` }
    : tone === "info" ? { background: t.accentBg, color: t.accent, borderColor: `${t.accent}30` }
      : { background: "rgba(239,68,68,0.08)", color: "#DC2626", borderColor: "rgba(239,68,68,0.3)" };

  if (!link) return <p className="text-sm" style={{ color: t.textMuted }}>Load ho raha hai…</p>;

  return (
    <div className="space-y-4">
      {/* Rules */}
      {asg && (
        <div className="rounded-lg border p-3 text-xs sm:text-sm space-y-1" style={{ background: t.bg, borderColor: t.border, color: t.textSecondary }}>
          {asg.instructions && <p style={{ color: t.textPrimary }}>{asg.instructions}</p>}
          <p>
            {asg.closes_at ? <>Deadline: <b>{fmtIST(asg.closes_at)}</b> · </> : null}
            Max {asg.max_pages} pages · har file max {Math.min(asg.max_mb, 10)} MB · PDF ya photos (JPG/PNG/WEBP/HEIC)
            · {asg.max_attempts} attempt{asg.max_attempts > 1 ? "s" : ""}
            {asg.max_attempts > 1 ? ` (${asg.count_policy === "best" ? "best marks wala" : "latest wala"} count hoga)` : ""}
          </p>
          {link.question_paper?.file_url && (
            <a href={link.question_paper.file_url} target="_blank" rel="noreferrer" className="font-medium underline" style={{ color: t.teal }}>
              Question paper dekho
            </a>
          )}
        </div>
      )}

      {link.state === "open_late" && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("info")}>
          Deadline nikal chuki hai. Upload ho jayega par <b>late</b> mark hoga.
        </div>
      )}
      {(linkClosed || studentBlocked) && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("error")}>
          {stateMessage(studentBlocked ? { state: link.student!.state }
                                       : { state: link.state, opens_at: asg?.opens_at, closes_at: asg?.closes_at })}
        </div>
      )}
      {noAttemptsLeft && !linkClosed && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("info")}>
          Aapke saare attempts use ho gaye. Neeche history mein status dekho.
        </div>
      )}

      {/* Picker + pages */}
      {canUpload && (
        <div className="space-y-2">
          <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
            onChange={async e => { await addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy || pages.length >= (asg?.max_pages || 0)}
            className="w-full py-2.5 rounded-lg border text-sm font-medium disabled:opacity-50"
            style={{ borderColor: t.border, color: t.accent, background: t.surface }}>
            + Pages add karo (photo / PDF)
          </button>
          {pages.length > 0 && (
            <ol className="space-y-1.5">
              {pages.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs sm:text-sm"
                  style={{ borderColor: p.state === "error" ? "rgba(239,68,68,0.4)" : t.border, background: t.bg }}>
                  <span className="w-12 shrink-0 font-semibold" style={{ color: t.textSecondary }}>Page {i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ color: t.textPrimary }}>{p.name}</span>
                    {p.error ? <span className="block text-red-600">{p.error}</span> : (
                      <span className="block" style={{ color: t.textMuted }}>
                        {p.state === "preparing" ? "Tayyar ho raha hai…" : p.state === "uploading" ? "Upload ho raha hai…"
                          : p.state === "uploaded" ? "Upload ho gaya ✓" : `${((p.prepared?.size || 0) / 1024).toFixed(0)} KB`}
                      </span>
                    )}
                  </span>
                  <button aria-label="Upar" disabled={busy || i === 0} onClick={() => move(i, -1)} className="px-1.5 disabled:opacity-30">▲</button>
                  <button aria-label="Neeche" disabled={busy || i === pages.length - 1} onClick={() => move(i, 1)} className="px-1.5 disabled:opacity-30">▼</button>
                  <button aria-label="Hatao" disabled={busy} onClick={() => setPages(x => x.filter(y => y.id !== p.id))} className="px-1.5 text-red-600 disabled:opacity-30">✕</button>
                </li>
              ))}
            </ol>
          )}
          <button onClick={submit} disabled={busy || locked || pages.length === 0}
            className="w-full py-3 rounded-lg text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            style={{ background: busy || locked ? "#94A3B8" : `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}>
            {busy ? "Submit ho raha hai…" : `Submit (${pages.length} page${pages.length === 1 ? "" : "s"})`}
          </button>
          {attemptsLeft !== null && <p className="text-center text-xs" style={{ color: t.textMuted }}>{attemptsLeft} attempt baaki</p>}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg border px-3 py-2 text-sm" style={toneStyle(notice.tone)}>{noticeText}</div>
      )}
      {warnings.map((w, i) => (
        <div key={i} className="rounded-lg border px-3 py-2 text-xs" style={toneStyle("info")}>⚠️ {w}</div>
      ))}

      {/* History */}
      {attempts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: t.textSecondary }}>Aapke uploads</h4>
          <ul className="space-y-2">
            {attempts.map(a => (
              <li key={a.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: t.border, background: t.bg }}>
                <div className="flex flex-wrap items-center gap-2">
                  <b style={{ color: t.textPrimary }}>{a.label}</b>
                  {a.counts && <span className="rounded px-1.5 text-[11px]" style={{ background: t.tealBg, color: t.teal }}>count hoga</span>}
                  {a.is_late && <span className="rounded px-1.5 text-[11px] bg-amber-100 text-amber-700">late</span>}
                  <span className="text-xs" style={{ color: t.textMuted }}>{a.submitted_at ? fmtIST(a.submitted_at) : ""} · {a.files.length} page(s)</span>
                </div>
                <p className="mt-1" style={{ color: a.status === "rejected" || a.status === "failed" ? "#DC2626" : t.textSecondary }}>
                  {a.result ? <>Marks: <b style={{ color: t.teal }}>{a.result.marks} / {a.result.max_marks}</b></> : (STATUS_TEXT[a.status] || a.status)}
                </p>
                {a.reject_reasons?.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-red-600">
                    {a.reject_reasons.map((r, i) => <li key={i}>{r.message}</li>)}
                  </ul>
                )}
                {a.status === "rejected" && <p className="mt-1 text-xs" style={{ color: t.textMuted }}>Ye attempt count nahi hua — sahi file ke saath dobara upload karo.</p>}
                {a.result && (
                  <>
                    {a.result.feedback && <p className="mt-1 text-xs" style={{ color: t.textPrimary }}>💬 {a.result.feedback}</p>}
                    {a.result.per_question?.length > 0 && (
                      <button className="mt-1 text-xs underline" style={{ color: t.accent }}
                        onClick={() => setOpenResult(openResult === a.id ? null : a.id)}>
                        {openResult === a.id ? "Question-wise chhupao" : "Question-wise marks dekho"}
                      </button>
                    )}
                    {openResult === a.id && (
                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          {a.result.per_question.map(q => (
                            <tr key={q.q_no} className="border-t" style={{ borderColor: t.border, opacity: q.counted ? 1 : 0.5 }}>
                              <td className="py-1 pr-2 font-semibold">Q{q.q_no}</td>
                              <td className="py-1 pr-2 whitespace-nowrap">{q.not_attempted ? "—" : q.marks} / {q.max_marks}</td>
                              <td className="py-1" style={{ color: t.textSecondary }}>{q.feedback}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
