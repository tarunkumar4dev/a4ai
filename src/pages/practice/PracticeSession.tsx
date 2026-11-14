// /practice/session?class&subject&chapter[&type][&page][&q] — 10 NCERT questions at a time.
// Everything that matters is in the URL (refresh, back / forward, a second tab land on the same question).
// Answers are shown only where the bank has a key; marks ("I got it" / "Review later") are the student's own,
// saved on this device and idempotent (lib/practiceProgress). No coins: practice can't be verified server-side.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, CheckCircle2, ChevronLeft, ChevronRight, Eye, ImageOff, Info, PartyPopper, RotateCcw } from "lucide-react";
import MathText from "@/components/MathText";
import {
  SET_SIZE, SUBJECTS_BY_CLASS, fetchQuestionPage, matchOption, practiceKeys, typeLabel, useQuestionPage, type PracticeQuestion,
} from "@/lib/practiceApi";
import { chapterMarks, clearMark, markQuestion, setLastSession, usePracticeProgress, type Mark } from "@/lib/practiceProgress";
import { NET_ERROR_TEXT, NetError } from "@/lib/net";
import { DifficultyBadge, EmptyState, ErrorState, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { cn } from "@/lib/utils";

const int = (v: string | null) => Math.max(0, Number.parseInt(v || "0", 10) || 0);

function Figure({ q }: { q: PracticeQuestion }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [q.id]);
  if (q.imageUrl && !failed) {
    return (
      <img src={q.imageUrl} alt={`Figure for question ${q.number ?? ""}`.trim()} loading="lazy" decoding="async" onError={() => setFailed(true)}
        className="mt-4 max-h-[420px] w-auto max-w-full rounded-lg border border-[#E5E7EB] bg-white object-contain" />
    );
  }
  if (failed || q.figureMissing) {
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F5F6F8] px-3 py-2 text-[12.5px] text-[#5D6570]">
        <ImageOff size={14} aria-hidden /> {failed ? "The figure couldn't load." : "This question refers to a figure from your NCERT book."}
      </p>
    );
  }
  return null;
}

function QuestionTable({ rows }: { rows: string[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-[13px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === 0 ? "bg-[#F5F6F8] font-semibold" : ""}>
              {r.map((c, j) => <td key={j} className="border border-[#E5E7EB] px-2 py-1.5"><MathText text={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionCard({ q, index, setLen, mark, onMark, onClear }: {
  q: PracticeQuestion; index: number; setLen: number; mark: Mark | null; onMark: (m: Mark) => void; onClear: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    setPicked(null); setChecked(false); setShowAnswer(false);
    headingRef.current?.focus({ preventScroll: true }); // screen readers start at the new question
  }, [q.id]);
  const keyIndex = matchOption(q.answer, q.options);
  const canCheck = q.options.length > 0 && keyIndex != null;

  return (
    <article aria-labelledby={`q-${q.id}`} className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`q-${q.id}`} ref={headingRef} tabIndex={-1} className="font-halenoir text-[15px] font-extrabold text-[#1B1B1B] outline-none">
          Question {index + 1} <span className="font-semibold text-[#5D6570]">of {setLen}</span>
        </h2>
        <span className="inline-flex h-6 items-center rounded-md bg-[#F1F2F4] px-2 text-[11.5px] font-semibold text-[#14243A]">{typeLabel(q.type)}</span>
        <DifficultyBadge level={q.difficulty} />
        {q.number && <span className="ml-auto text-[12px] tabular-nums text-[#5D6570]">NCERT {q.number}</span>}
      </div>
      {q.section && <p className="mt-1 truncate text-[12px] text-[#5D6570]" title={q.section}>{q.section}</p>}

      <div className="mt-4 break-words text-[15.5px] leading-[1.7] text-[#1B1B1B] [overflow-wrap:anywhere]">
        <MathText text={q.text} />
      </div>
      {q.table && <QuestionTable rows={q.table} />}
      <Figure q={q} />

      {q.options.length > 0 && (
        <fieldset className="mt-5">
          <legend className="sr-only">Options</legend>
          <div className="grid gap-2">
            {q.options.map((o, i) => {
              const right = checked && i === keyIndex;
              const wrong = checked && i === picked && i !== keyIndex;
              return (
                <label key={i} className={cn("flex min-h-[48px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-[14.5px]",
                  right ? "border-[#168B59] bg-[#E7F6EE]" : wrong ? "border-[#A92532] bg-[#FBEBED]" : picked === i ? "border-[#14243A] bg-[#F5F6F8]" : "border-[#E5E7EB] hover:border-[#9CA3AF]")}>
                  <input type="radio" name={`opt-${q.id}`} className="mt-1 h-4 w-4 accent-[#14243A]" checked={picked === i} disabled={checked}
                    onChange={() => setPicked(i)} />
                  <span className="font-semibold text-[#5D6570]">{String.fromCharCode(97 + i)})</span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><MathText text={o} /></span>
                  {right && <span className="text-[12px] font-semibold text-[#0E6B43]">Correct</span>}
                </label>
              );
            })}
          </div>
          {canCheck && !checked && (
            <button type="button" onClick={() => setChecked(true)} disabled={picked == null} className={cn(BTN_PRIMARY_MD, "mt-3 disabled:opacity-50")}>Check answer</button>
          )}
          {checked && (
            <p role="status" className={cn("mt-3 text-[13.5px] font-semibold", picked === keyIndex ? "text-[#0E6B43]" : "text-[#A92532]")}>
              {picked === keyIndex ? "Correct!" : `Not quite — the answer is option ${String.fromCharCode(97 + (keyIndex ?? 0))}.`}
            </p>
          )}
        </fieldset>
      )}

      <div className="mt-5 border-t border-[#E5E7EB] pt-4">
        {q.answer ? (
          showAnswer ? (
            <div className="rounded-lg border border-[#CFE8DA] bg-[#F3FAF6] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#0E6B43]">Answer</p>
              <div className="mt-1 break-words text-[14.5px] leading-[1.7] text-[#1B1B1B] [overflow-wrap:anywhere]"><MathText text={q.answer} /></div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAnswer(true)} className={BTN_SECONDARY_MD}><Eye size={15} aria-hidden /> Show answer</button>
          )
        ) : (
          <p className="flex items-start gap-2 text-[13px] text-[#5D6570]">
            <Info size={15} aria-hidden className="mt-0.5 shrink-0" /> No answer key for this question. Solve it in your notebook and check with your NCERT book or teacher.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="How did it go?">
          <button type="button" aria-pressed={mark === "got"} onClick={() => onMark("got")}
            className={cn("inline-flex h-11 items-center gap-1.5 rounded-lg border px-4 text-[14px] font-semibold",
              mark === "got" ? "border-[#0E6B43] bg-[#0E6B43] text-white" : "border-[#BFE3CF] bg-white text-[#0E6B43] hover:bg-[#F3FAF6]", FOCUS_RING)}>
            <CheckCircle2 size={16} aria-hidden /> I got it
          </button>
          <button type="button" aria-pressed={mark === "review"} onClick={() => onMark("review")}
            className={cn("inline-flex h-11 items-center gap-1.5 rounded-lg border px-4 text-[14px] font-semibold",
              mark === "review" ? "border-[#7A5200] bg-[#7A5200] text-white" : "border-[#F2D9A2] bg-white text-[#7A5200] hover:bg-[#FFF8E8]", FOCUS_RING)}>
            <BookmarkPlus size={16} aria-hidden /> Review later
          </button>
          {mark && <button type="button" onClick={onClear} className={cn("h-11 rounded-lg px-2 text-[13px] font-medium text-[#5D6570] underline underline-offset-2", FOCUS_RING)}>Undo</button>}
        </div>
      </div>
    </article>
  );
}

export default function PracticeSession() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { uid } = useStudentShell();
  const store = usePracticeProgress(uid);
  const [params, setParams] = useSearchParams();
  const cls = params.get("class") || "";
  const subject = params.get("subject") || "";
  const chapter = params.get("chapter") || "";
  const type = params.get("type") || null;
  const page = int(params.get("page"));
  const qParam = int(params.get("q"));
  const valid = !!cls && !!chapter && (SUBJECTS_BY_CLASS[cls] ?? []).some((s) => s.toLowerCase() === subject.toLowerCase());
  const [finished, setFinished] = useState(false);

  const data = useQuestionPage(valid ? { cls, subject, chapter, type, page } : null);
  const questions = data.data?.questions ?? [];
  const total = data.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / SET_SIZE));
  const qi = Math.min(qParam, Math.max(0, questions.length - 1));
  const q = data.isPlaceholderData ? null : questions[qi] ?? null;

  const go = useCallback((next: { page?: number; q?: number }, push = false) => {
    const p = new URLSearchParams(params);
    p.set("page", String(next.page ?? page));
    p.set("q", String(next.q ?? qi));
    setParams(p, { replace: !push });
  }, [params, page, qi, setParams]);

  useEffect(() => {
    if (valid) setLastSession(uid, { c: cls, s: subject, ch: chapter, type, page, q: qi });
  }, [valid, uid, cls, subject, chapter, type, page, qi]);

  // fetch the next set in the background near the end of this one
  useEffect(() => {
    if (!valid || !data.data?.hasMore || qi < SET_SIZE - 4) return;
    qc.prefetchQuery({
      queryKey: practiceKeys.page(cls, subject, chapter, type, page + 1),
      queryFn: ({ signal }) => fetchQuestionPage({ cls, subject, chapter, type, page: page + 1 }, signal),
      staleTime: 30 * 60_000,
    });
  }, [valid, data.data?.hasMore, qi, qc, cls, subject, chapter, type, page]);

  const prev = () => (qi > 0 ? go({ q: qi - 1 }) : page > 0 ? go({ page: page - 1, q: SET_SIZE - 1 }, true) : undefined);
  const next = () => {
    if (qi < questions.length - 1) return go({ q: qi + 1 });
    if (data.data?.hasMore) return go({ page: page + 1, q: 0 }, true);
    setFinished(true);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable]") || e.altKey || e.ctrlKey || e.metaKey)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const meta = { c: cls, s: subject, ch: chapter };
  const ch = useMemo(() => chapterMarks(store, cls, subject, chapter), [store, cls, subject, chapter]);
  const err = data.error instanceof NetError ? data.error.message : data.error ? NET_ERROR_TEXT.server : null;
  const back = `/practice?class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(subject)}${type ? `&type=${encodeURIComponent(type)}` : ""}`;

  const sidebar = valid ? (
    <>
      <SideCard title="This chapter" labelledBy="chapter-progress">
        <div className="flex items-center gap-3">
          <SubjectTile subject={subject} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1B1B1B]" title={chapter}>{chapter}</p>
            <p className="text-[12px] text-[#5D6570]">Class {cls} · {subject}{type ? ` · ${typeLabel(type)}` : ""}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Questions", total || "—"], ["Got it", ch.got], ["To review", ch.review]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-[#F5F6F8] px-2 py-2">
              <dt className="text-[11px] font-medium text-[#5D6570]">{l}</dt>
              <dd className="font-halenoir text-[17px] font-extrabold tabular-nums text-[#1B1B1B]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11.5px] text-[#5D6570]">Marked by you, saved on this device.</p>
      </SideCard>
      <SideCard title="Shortcuts" labelledBy="shortcuts">
        <p className="text-[12.5px] text-[#5D6570]">Use <kbd className="rounded border border-[#D5D9DF] px-1">←</kbd> and <kbd className="rounded border border-[#D5D9DF] px-1">→</kbd> to move between questions.</p>
      </SideCard>
    </>
  ) : undefined;

  return (
    <StudentLayout title={chapter ? `${chapter} · Practice` : "Practice"} sidebar={sidebar}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[13px] text-[#5D6570]">
        <Link to="/practice" className={cn("rounded font-medium hover:text-[#1B1B1B]", FOCUS_RING)}>Practice</Link>
        {valid && <><ChevronRight size={14} aria-hidden /><Link to={back} className={cn("rounded font-medium hover:text-[#1B1B1B]", FOCUS_RING)}>Class {cls} · {subject}</Link></>}
        {valid && <><ChevronRight size={14} aria-hidden /><span className="truncate text-[#1B1B1B]" aria-current="page">{chapter}</span></>}
      </nav>

      {!valid ? (
        <EmptyState className="mt-6" icon={<Info size={24} aria-hidden />} title="This practice link is incomplete"
          body="Pick a class, subject and chapter to start." action={<Link to="/practice" className={BTN_PRIMARY_MD}>Go to Practice</Link>} />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <h1 className="font-halenoir text-[22px] font-extrabold leading-tight md:text-[26px]">{chapter}</h1>
            {total > 0 && <p className="text-[13px] tabular-nums text-[#5D6570]">Set {page + 1} of {pages} · {total} questions</p>}
          </div>

          {/* question navigator */}
          {questions.length > 0 && !finished && (
            <ol aria-label="Questions in this set" className="mt-4 flex flex-wrap gap-1.5">
              {questions.map((x, i) => {
                const m = store.marks[x.id]?.m;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => go({ q: i })} aria-current={i === qi ? "step" : undefined}
                      aria-label={`Question ${i + 1}${m === "got" ? ", got it" : m === "review" ? ", review later" : ""}`}
                      className={cn("grid h-9 w-9 place-items-center rounded-lg border text-[13px] font-semibold tabular-nums",
                        i === qi ? "border-[#14243A] bg-[#14243A] text-white"
                          : m === "got" ? "border-[#BFE3CF] bg-[#E7F6EE] text-[#0E6B43]"
                          : m === "review" ? "border-[#F2D9A2] bg-[#FFF8E8] text-[#7A5200]"
                          : "border-[#E5E7EB] bg-white text-[#1B1B1B] hover:border-[#9CA3AF]", FOCUS_RING)}>
                      {i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4">
            {data.isPending ? (
              <div aria-hidden className="h-[360px] rounded-xl border border-[#E5E7EB] bg-white p-6">
                <div className="h-5 w-40 rounded bg-[#EEF0F3]" /><div className="mt-5 h-4 w-full rounded bg-[#EEF0F3]" /><div className="mt-2 h-4 w-4/5 rounded bg-[#EEF0F3]" />
              </div>
            ) : err ? (
              <ErrorState message={err} onRetry={() => data.refetch()} />
            ) : finished ? (
              <section aria-labelledby="done-title" className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-center">
                <PartyPopper size={28} aria-hidden className="mx-auto text-[#A92532]" />
                <h2 id="done-title" className="mt-2 font-halenoir text-[20px] font-extrabold">Chapter finished</h2>
                <p className="mt-1 text-[13.5px] text-[#5D6570]">You marked <b className="text-[#0E6B43]">{ch.got} got it</b> and <b className="text-[#7A5200]">{ch.review} to review</b> in this chapter.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => { setFinished(false); go({ page: 0, q: 0 }, true); }} className={BTN_SECONDARY_MD}><RotateCcw size={14} aria-hidden /> Start again</button>
                  <Link to={back} className={BTN_PRIMARY_MD}>Choose another chapter</Link>
                </div>
              </section>
            ) : !q ? (
              <EmptyState icon={<Info size={24} aria-hidden />} title={questions.length === 0 && !data.isPlaceholderData ? "No questions in this set" : "Loading the next set…"}
                body={questions.length === 0 && !data.isPlaceholderData ? "This chapter (or this question type) has no questions left here." : undefined}
                action={questions.length === 0 && !data.isPlaceholderData ? <Link to={back} className={BTN_PRIMARY_MD}>Back to chapters</Link> : undefined} />
            ) : (
              <QuestionCard key={q.id} q={q} index={qi} setLen={questions.length}
                mark={store.marks[q.id]?.m ?? null}
                onMark={(m) => markQuestion(uid, q.id, m, meta)}
                onClear={() => clearMark(uid, q.id)} />
            )}
          </div>

          {q && !finished && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={prev} disabled={qi === 0 && page === 0} className={cn(BTN_SECONDARY_MD, "h-11 disabled:opacity-40")}>
                <ChevronLeft size={16} aria-hidden /> Previous
              </button>
              <button type="button" onClick={next} className={cn(BTN_PRIMARY_MD, "h-11")}>
                {qi < questions.length - 1 ? "Next" : data.data?.hasMore ? "Next set" : "Finish chapter"} <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          )}
          <button type="button" onClick={() => navigate(back)} className={cn("mt-6 inline-flex h-10 items-center gap-1.5 rounded-lg text-[13px] font-semibold text-[#5D6570] hover:text-[#1B1B1B] lg:hidden", FOCUS_RING)}>
            <ArrowLeft size={14} aria-hidden /> All chapters
          </button>
        </>
      )}
    </StudentLayout>
  );
}

