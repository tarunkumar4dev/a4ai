// Royal-blue banner: paste a contest code / link → preview → Register (scheduled) / Start (live) / Leaderboard (ended).
// Double clicks: the button locks synchronously (ref) before the request; the server keeps one row per
// (contest, student) anyway, so a retry or a second tab only ever gets "already registered".
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { formatWhen, nextBoundary, primaryAction, actionView, contestPath, type FeedContest } from "@/lib/contestLifecycle";
import { FeedError, getContestCard, reportContestError, type RegisterState, useRegisterContest } from "@/lib/contestFeed";
import { serverNow } from "@/lib/serverClock";
import { Countdown, useOnPhaseChange, usePhase } from "./ContestBits";
import { BANNER_BOX } from "./ContestBanners";
import { BannerGeometry } from "@/components/student/Banner";
import { cn } from "@/lib/utils";

export const JOIN_INPUT_ID = "contest-code";

const REGISTER_TEXT: Record<RegisterState, string> = {
  registered: "Registered. It's in your Upcoming list.",
  already_registered: "You're already registered. It's in your Upcoming list.",
  owner: "This is your own contest.",
  ended: "This contest has ended.",
  not_found: "No contest has this code.",
  invalid_code: "That doesn't look like a contest code.",
};

// navy on royal blue ≥ 3:1 (button shape); white text on navy 15:1
const ON_BLUE_BTN = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#14243A] px-4 text-[13px] font-semibold text-white hover:bg-[#0B1626] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#246BCE]";

function Preview({ c, uid, onClear, onZero }: { c: FeedContest; uid: string | null; onClear: () => void; onZero: () => void }) {
  const navigate = useNavigate();
  const phase = usePhase(c);
  useOnPhaseChange(phase, onZero);
  const register = useRegisterContest(uid);
  const lock = useRef(false);
  const [done, setDone] = useState<RegisterState | null>(null);
  const action = primaryAction(c, phase);
  const view = actionView(action, c);
  const b = nextBoundary(c, serverNow());

  const onRegister = async () => {
    if (lock.current) return; // second click before React re-rendered the disabled button
    lock.current = true;
    try {
      setDone((await register.mutateAsync(c.short_code)).state);
    } catch {
      /* message below from register.error */
    } finally {
      lock.current = false;
    }
  };

  const registered = done === "registered" || done === "already_registered" || action.kind === "registered";
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white">Contest found</p>
          <p className="mt-1 line-clamp-2 font-halenoir text-[19px] font-extrabold leading-tight text-white" title={c.title}>{c.title}</p>
          <p className="mt-1 truncate text-[12.5px] text-white">
            {[c.subject, c.duration_minutes ? `${c.duration_minutes} min` : null, c.total_questions ? `${c.total_questions} Qs` : null]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onClear} aria-label="Use another code"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white hover:bg-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-[13px] text-white">
        {b ? <>{b.label} <Countdown at={b.at} className="font-bold" /></>
          : phase === "ended" ? `Ended ${formatWhen(c.expires_at)}` : phase === "paused" ? "Paused by the teacher" : "Open now"}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2" aria-live="polite">
        {registered ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white">
            <CheckCircle2 size={16} aria-hidden /> {done ? REGISTER_TEXT[done] : "You're registered."}
          </span>
        ) : action.kind === "register" ? (
          <button type="button" className={ON_BLUE_BTN} onClick={onRegister} disabled={register.isPending} aria-busy={register.isPending}>
            {register.isPending ? "Registering…" : "Register"}
          </button>
        ) : view.href ? (
          <button type="button" className={ON_BLUE_BTN} onClick={() => navigate(view.href!)}>
            {view.label} <ArrowRight size={14} aria-hidden />
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-white">{view.label}</span>
        )}
        {done && !registered && <span className="text-[12.5px] font-semibold text-white">{REGISTER_TEXT[done]}</span>}
        {register.isError && (
          <span className="rounded bg-white px-1.5 py-0.5 text-[12.5px] font-semibold text-[#A92532]">
            {register.error instanceof FeedError ? register.error.message : "Couldn't register. Try again."}
          </span>
        )}
      </div>
    </div>
  );
}

export function JoinCodeCard({ uid, onZero, className }: { uid: string | null; onZero: () => void; className?: string }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<FeedContest | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    setError("");
    try {
      const res = await getContestCard(value, ctl.current.signal);
      if (res.state === "ok" && res.contest) setFound(res.contest);
      else setError(res.state === "invalid_code" ? REGISTER_TEXT.invalid_code : REGISTER_TEXT.not_found);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      // 29 not applied yet: open the contest page directly (it works without the list)
      if (err instanceof FeedError && err.kind === "missing") {
        const m = value.toLowerCase().match(/contests?\/(?:live\/)?([a-z0-9]{4,10})/);
        navigate(contestPath({ short_code: m ? m[1] : value.toLowerCase().replace(/[^a-z0-9]/g, "") }));
        return;
      }
      reportContestError("card", err);
      setError(err instanceof FeedError ? err.message : "Couldn't look up that code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="join" aria-labelledby="join-code-title" className={cn(BANNER_BOX, "bg-[#246BCE] text-white", className)}>
      <BannerGeometry variant="blue" />
      {found ? (
        <Preview c={found} uid={uid} onZero={onZero} onClear={() => { setFound(null); setCode(""); }} />
      ) : (
        <form onSubmit={onSubmit} className="relative flex h-full flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white">Have a code?</p>
          <h2 id="join-code-title" className="mt-1 font-halenoir text-[22px] font-extrabold leading-tight">Join a contest</h2>
          <p className="mt-1 max-w-[34ch] text-[13px] text-white">Paste the code or link your teacher shared. You'll see the contest before you join.</p>
          <div className="mt-auto flex gap-2">
            <label htmlFor={JOIN_INPUT_ID} className="sr-only">Contest code or link</label>
            <input id={JOIN_INPUT_ID} value={code} onChange={(e) => { setCode(e.target.value); setError(""); }}
              placeholder="e.g. k3m9x2qa" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200}
              aria-invalid={!!error} aria-describedby={error ? "contest-code-error" : undefined}
              className="h-10 min-w-0 flex-1 rounded-lg border-0 bg-white px-3 text-[14px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus-visible:ring-2 focus-visible:ring-[#14243A]" />
            <button type="submit" disabled={busy || !code.trim()} className={cn(ON_BLUE_BTN, "shrink-0")} aria-busy={busy}>
              {busy ? "Looking…" : "Find"}
            </button>
          </div>
          <p id="contest-code-error" role="alert" className={cn("mt-1.5 min-h-[20px] text-[12.5px] font-semibold", error && "self-start rounded bg-white px-1.5 text-[#A92532]")}>{error}</p>
        </form>
      )}
    </section>
  );
}
