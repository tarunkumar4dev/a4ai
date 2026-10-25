// src/pages/ContestPage.tsx
// /contest/:shortCode — lobby first (rules, camera check), /start only when the student taps Start.
// The camera permission prompt happens HERE, so its focus loss is never counted as a tab switch, and the
// working stream is handed to the attempt page (no second prompt).
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CheckCircle2, Clock, FileText, Loader2, ShieldAlert } from "lucide-react";
import { contestApi, ContestApiError, ContestData, ContestInfo, notStartedTiming, startErrorMessage } from "@/lib/contestApi";
import ContestAttemptPage from "@/components/contest/ContestAttemptPage";
import type { AttemptProgress } from "@/lib/contestProgress";
import { CONTEST_FONT_STACK, CONTEST_NAVY, useContestFont } from "@/lib/contestFont";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { cleanName, isRealName, isValidName, loadSavedName, saveName } from "@/lib/studentName";

const attemptMarker = (code: string) => `a4_contest_attempt_${code}`;
const readMarker = (code: string) => { try { return localStorage.getItem(attemptMarker(code)); } catch { return null; } };
const writeMarker = (code: string, id: string) => { try { localStorage.setItem(attemptMarker(code), id); } catch { /* ignore */ } };

type CamState = "idle" | "asking" | "on" | "denied" | "missing" | "busy" | "error";

function cameraHelp(state: CamState): string | null {
  if (state === "denied") {
    return "Camera is blocked. Android (Chrome): tap the 🔒 / ⓘ icon left of the address bar → Permissions → Camera → Allow, then tap “Try again”. iPhone (Safari): tap “aA” in the address bar → Website Settings → Camera → Allow (or Settings → Safari → Camera → Allow), then tap “Try again”.";
  }
  if (state === "missing") return "No camera was found on this device. Use a phone or laptop with a front camera.";
  if (state === "busy") return "The camera is being used by another app (video call, camera app). Close it and tap “Try again”.";
  if (state === "error") return "The camera could not start. Tap “Try again”, or restart the browser.";
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col items-center" style={{ fontFamily: CONTEST_FONT_STACK }}>
      <div className="w-full text-white" style={{ background: CONTEST_NAVY }}>
        <p className="max-w-md mx-auto px-4 py-3 text-sm font-bold">a4ai · Online test</p>
      </div>
      <div className="w-full max-w-md p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}
const NAVY_BTN = "bg-[#1F3A68] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1F3A68]";

export default function ContestPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [info, setInfo] = useState<ContestInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [blocker, setBlocker] = useState<string | null>(null);   // not started / ended / not found
  /** contest not open yet: when it opens (server time on this device's clock) and when to look again */
  const [notStarted, setNotStarted] = useState<{ opensAt: number | null; nextCheckMs: number } | null>(null);
  const [, setTick] = useState(0);
  const [contestData, setContestData] = useState<(ContestData & { receivedAt: number }) | null>(null);
  const [already, setAlready] = useState<{ score?: number | null; total_marks?: number; percentage?: number | null } | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [cam, setCam] = useState<CamState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handedOver = useRef(false);
  const resumable = shortCode ? !!readMarker(shortCode) : false;
  useContestFont();

  // ── Leaderboard name: profile full_name, else asked once here (remembered on this device + saved to the profile) ──
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(() => {
    const meta = user?.user_metadata?.full_name;
    return isRealName(meta) ? cleanName(meta) : null;
  });
  const [nameChecked, setNameChecked] = useState(!!profileName);
  const [typedName, setTypedName] = useState(loadSavedName);
  useEffect(() => {
    if (profileName || !user?.id) { setNameChecked(true); return; }
    let alive = true;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (alive && isRealName(data?.full_name)) setProfileName(cleanName(data!.full_name)); })
      .then(() => { if (alive) setNameChecked(true); }, () => { if (alive) setNameChecked(true); });
    return () => { alive = false; };
  }, [user?.id, profileName]);
  const needName = nameChecked && !profileName;
  const nameOk = !needName || isValidName(typedName);

  // silent: the automatic re-check keeps the "opens in" screen up instead of flashing "Loading…"
  const loadInfo = useCallback((silent = false) => {
    if (!shortCode) return;
    if (!silent) { setInfoLoading(true); setBlocker(null); }
    contestApi.getContestInfo(shortCode)
      .then((i) => { setInfo(i); setNotStarted(null); setBlocker(null); })
      .catch((err) => {
        if (err instanceof ContestApiError && err.code === "CONTEST_NOT_STARTED") {
          setBlocker(startErrorMessage(err));
          setNotStarted(notStartedTiming(err, Date.now()));
        }
        else if (/not found|ended|paused/i.test(err?.message || "")) setBlocker(err.message);
        // anything else (network, old backend): the lobby still works without /info
      })
      .finally(() => setInfoLoading(false));
  }, [shortCode]);
  useEffect(() => loadInfo(), [loadInfo]);

  // Not open yet: look again right when the server says it opens (and every 15 s anyway); the lobby then
  // appears by itself. The countdown ticks once a second.
  useEffect(() => {
    if (!notStarted) return;
    const again = setTimeout(() => loadInfo(true), notStarted.nextCheckMs);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => { clearTimeout(again); clearInterval(tick); };
  }, [notStarted, loadInfo]);

  // lobby camera preview; stopped on leave unless it was handed to the attempt
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, cam]);
  useEffect(() => () => { if (!handedOver.current) stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  const askCamera = async () => {
    setCam("asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
      setStream(s);
      setCam("on");
      s.getVideoTracks()[0]?.addEventListener("ended", () => { setCam("error"); setStream(null); });
    } catch (e: any) {
      const name = e?.name || "";
      setCam(name === "NotAllowedError" || name === "SecurityError" ? "denied"
        : name === "NotFoundError" || name === "OverconstrainedError" ? "missing"
        : name === "NotReadableError" || name === "AbortError" ? "busy" : "error");
    }
  };

  const needCamera = !!info?.enable_camera;
  const canStart = !starting && !blocker && nameChecked && nameOk && (!needCamera || cam === "on");

  const start = async () => {
    if (!shortCode || !canStart) return;
    setStarting(true);
    setStartError(null);
    try {
      const studentName = profileName || cleanName(typedName);
      if (needName) {
        saveName(studentName);
        if (user?.id) {
          // best effort: next time the profile already has it
          supabase.from("profiles").update({ full_name: studentName }).eq("id", user.id).then(() => {}, () => {});
        }
      }
      const data = await contestApi.startAttempt(shortCode, studentName, user?.email || undefined);
      writeMarker(shortCode, data.attempt_id);
      handedOver.current = !!stream;
      setContestData({ ...data, receivedAt: Date.now() });
    } catch (err: any) {
      if (err instanceof ContestApiError && (err.code === "ALREADY_SUBMITTED" || err.status === 409)) {
        const r = err.body?.result || err.detail?.result || err.body;
        setAlready({ score: r?.score, total_marks: r?.total_marks, percentage: r?.percentage });
      } else if (err instanceof ContestApiError && (err.code === "CONTEST_NOT_STARTED" || err.status === 410)) {
        setBlocker(err.status === 410 ? "This contest has ended." : startErrorMessage(err));
        if (err.code === "CONTEST_NOT_STARTED") setNotStarted(notStartedTiming(err, Date.now()));
      } else {
        setStartError(startErrorMessage(err, "Could not start the contest. Check your internet and try again."));
      }
    } finally {
      setStarting(false);
    }
  };

  if (contestData) {
    return (
      <ContestAttemptPage
        config={{
          contestId: contestData.contest_id,
          attemptId: contestData.attempt_id,
          title: contestData.title,
          subject: contestData.subject,
          classGrade: contestData.class_grade,
          totalMarks: contestData.questions.reduce((s, q) => s + q.marks, 0),
          totalQuestions: contestData.questions.length,
          durationMinutes: contestData.duration_minutes,
          teacherName: "",
          showInstantAnswers: contestData.answer_mode === "instant",
          showAnswersAfterTest: contestData.answer_mode === "after_test",
          showNoAnswers: contestData.answer_mode === "none",
          resultsByTeacher: contestData.answer_mode === "teacher_release",
          retryOf: contestData.retry_of ?? null,
          showExplanation: contestData.show_explanation,
          allowBackNavigation: contestData.allow_back_navigation,
          enableCamera: contestData.enable_camera,
          enableTabDetection: contestData.enable_tab_detection,
          maxWarnings: contestData.max_warnings,
          questions: contestData.questions.map((q) => ({
            ...q,
            questionNumber: q.question_number,
            questionText: q.question_text,
            difficulty: q.difficulty as any,
            type: q.question_type as any,
            options: q.options || [],
          })),
          startedAt: contestData.started_at,
          deadlineAt: contestData.deadline_at,
          serverNow: contestData.server_now,
          receivedAt: contestData.receivedAt,
          // the server sends plain strings for warning types; the attempt page only appends / counts them
          progress: (contestData.progress ?? null) as Partial<AttemptProgress> | null,
          snapshotsEnabled: contestData.snapshots_enabled,
          cameraStream: stream,
        }}
      />
    );
  }

  if (already) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="text-xl font-extrabold text-gray-900">You have already submitted</h1>
          {already.score != null && already.total_marks != null ? (
            <p className="text-3xl font-extrabold text-gray-900">{already.score}<span className="text-base text-gray-600">/{already.total_marks}</span></p>
          ) : null}
          <p className="text-sm text-gray-500">Your answers were recorded. Your teacher will share the results.</p>
        </div>
      </Shell>
    );
  }

  if (infoLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 gap-2"><Loader2 size={18} className="animate-spin" /> Loading contest…</div>;
  }

  if (blocker) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <Clock size={40} className="mx-auto text-gray-600" />
          <p className="text-base font-bold text-gray-900">{blocker}</p>
          {notStarted?.opensAt != null && notStarted.opensAt > Date.now() && (
            <p className="text-2xl font-bold tabular-nums text-[#1F3A68]" aria-live="polite">
              Opens in {(() => { const s = Math.ceil((notStarted.opensAt - Date.now()) / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`; })()}
            </p>
          )}
          {notStarted && <p className="text-xs text-gray-600">This page opens the test by itself when it starts.</p>}
          <button onClick={() => loadInfo()} className={`px-5 min-h-[48px] rounded-lg text-sm font-bold ${NAVY_BTN}`}>Check again</button>
        </div>
      </Shell>
    );
  }

  const maxWarnings = info?.max_warnings || 5;
  const help = cameraHelp(cam);

  return (
    <Shell>
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 leading-tight">{info?.title || "Contest"}</h1>
        {info && <p className="text-xs text-gray-500 mt-1">{[info.subject, info.class_grade, info.teacher_name && `by ${info.teacher_name}`].filter(Boolean).join(" · ")}</p>}
      </div>

      {info && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-gray-50 py-3"><p className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-1"><Clock size={16} />{info.duration_minutes} min</p><p className="text-[11px] font-bold uppercase text-gray-600">Duration</p></div>
          <div className="rounded-2xl bg-gray-50 py-3"><p className="text-lg font-extrabold text-gray-900 inline-flex items-center gap-1"><FileText size={16} />{info.total_questions}</p><p className="text-[11px] font-bold uppercase text-gray-600">Questions</p></div>
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5 text-sm text-amber-900">
        <p className="font-bold flex items-center gap-1.5"><ShieldAlert size={16} /> Rules</p>
        {(info?.enable_tab_detection ?? true) && <p>• Stay on this page. Leaving it (other app / tab) counts as a tab switch — after {maxWarnings} tab switches the test is submitted automatically.</p>}
        {needCamera && <p>• Keep your camera on for the whole test.</p>}
        <p>• Don't refresh or close this page. If it happens, open the link again and tap Continue — your answers are kept.</p>
        <p>• The timer keeps running even if you leave.</p>
      </div>

      {needName && (
        <label className="block">
          <span className="text-sm font-bold text-gray-900">Your name for the leaderboard <span className="text-red-600">*</span></span>
          <input value={typedName} onChange={(e) => setTypedName(e.target.value)} maxLength={40} autoComplete="name"
            placeholder="e.g. Priya Sharma"
            className="mt-1 w-full min-h-[48px] rounded-lg border-2 border-gray-300 px-3 text-base text-gray-900 focus:border-[#1F3A68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A68]" />
          <span className={`text-xs ${typedName && !isValidName(typedName) ? "text-red-700 font-semibold" : "text-gray-600"}`}>
            {typedName && !isValidName(typedName) ? "Use 2–40 characters." : "Your classmates will see this name."}
          </span>
        </label>
      )}

      {needCamera && (
        <div className="space-y-2">
          <div className="rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex items-center justify-center">
            {cam === "on" && stream
              ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              : <Camera size={32} className="text-gray-500" />}
          </div>
          {cam !== "on" && (
            <button onClick={askCamera} disabled={cam === "asking"}
              className="w-full min-h-[48px] rounded-lg bg-white border-2 border-[#1F3A68] text-[#1F3A68] text-sm font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1F3A68]">
              {cam === "asking" ? "Waiting for permission…" : cam === "idle" ? "Turn on camera" : "Try again"}
            </button>
          )}
          {cam === "on" && <p className="text-xs font-semibold text-emerald-700">✓ Camera is working</p>}
          {help && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-relaxed">{help}</p>}
        </div>
      )}

      {startError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{startError}</p>}

      <button onClick={start} disabled={!canStart}
        className={`w-full min-h-[52px] rounded-lg font-bold text-sm disabled:bg-gray-300 disabled:text-gray-600 inline-flex items-center justify-center gap-2 ${NAVY_BTN}`}>
        {starting ? <><Loader2 size={16} className="animate-spin" /> Starting…</> : resumable ? "Continue test" : "Start test"}
      </button>
      {needCamera && cam !== "on" && <p className="text-[11px] text-center text-gray-600">Start unlocks once your camera works.</p>}
    </Shell>
  );
}
