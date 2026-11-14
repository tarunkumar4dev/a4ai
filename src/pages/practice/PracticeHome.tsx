// /practice — NCERT practice discovery: class → subject (live question counts) → chapter (search, question type,
// progress) → session. State lives in the URL (?class&subject&type) so back / forward / refresh keep it.
// Data: lib/practiceApi (existing backend endpoints, cached). Progress: lib/practiceProgress (this device).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpenCheck, CheckCircle2, Info, ListChecks, RotateCcw, Search } from "lucide-react";
import {
  PRACTICE_CLASSES, SUBJECTS_BY_CLASS, hasQuestions, practiceSessionHref, typeLabel, useChapterStats, type ChapterStat,
} from "@/lib/practiceApi";
import { chapterMarks, setPracticeClass, subjectMarks, summarize, usePracticeProgress } from "@/lib/practiceProgress";
import { NET_ERROR_TEXT, NetError } from "@/lib/net";
import { HeroBanner, EYEBROW, ON_DARK_BTN } from "@/components/student/Banner";
import { EmptyState, ErrorState, SectionHeader, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { ClassPicker } from "@/components/student/ClassPicker";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { cn } from "@/lib/utils";

const sessionHref = practiceSessionHref;

function SubjectCard({ cls, subject, selected, onSelect, marked }: {
  cls: string; subject: string; selected: boolean; onSelect: () => void; marked: number;
}) {
  const stats = useChapterStats(cls, subject);
  const total = stats.data?.reduce((a, c) => a + c.total, 0);
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={cn("flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition-[border-color,box-shadow]",
        selected ? "border-[#14243A] shadow-[0_0_0_1px_#14243A]" : "border-[#E5E7EB] hover:border-[#CBD0D7] hover:shadow-[0_2px_10px_rgba(20,36,58,0.06)]", FOCUS_RING)}>
      <SubjectTile subject={subject} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-halenoir text-[15px] font-bold text-[#1B1B1B]">{subject}</span>
        <span className="mt-0.5 block text-[12.5px] tabular-nums text-[#5D6570]">
          {stats.isPending ? <span className="inline-block h-3 w-24 rounded bg-[#EEF0F3] align-middle" aria-label="Loading count" />
            : stats.isError ? "Count unavailable"
            : `${(total ?? 0).toLocaleString("en-IN")} questions · ${stats.data?.length ?? 0} chapter${stats.data?.length === 1 ? "" : "s"}`}
        </span>
        {marked > 0 && <span className="mt-1 block text-[11.5px] font-semibold text-[#0E6B43]">{marked} marked on this device</span>}
      </span>
      <ArrowRight size={16} aria-hidden className="shrink-0 text-[#5D6570]" />
    </button>
  );
}

function ChapterCard({ cls, subject, c, type, got, review }: {
  cls: string; subject: string; c: ChapterStat; type: string | null; got: number; review: number;
}) {
  const count = type ? c.types.find((t) => t.name === type)?.count ?? 0 : c.total;
  const pct = c.total ? Math.min(100, Math.round(((got + review) / c.total) * 100)) : 0;
  return (
    <li className="list-none">
      <article className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#CBD0D7]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 min-w-[36px] place-items-center rounded-lg bg-[#F5F6F8] px-2 font-halenoir text-[13px] font-extrabold tabular-nums text-[#14243A]">
            {c.chapterNo ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-halenoir text-[15px] font-bold leading-snug text-[#1B1B1B]" title={c.chapter}>{c.chapter}</h3>
            <p className="mt-0.5 text-[12.5px] tabular-nums text-[#5D6570]">
              {count} {type ? typeLabel(type).toLowerCase() : "questions"}
              {c.types.length > 0 && !type && ` · ${c.types.slice(0, 3).map((t) => typeLabel(t.name)).join(", ")}`}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11.5px] text-[#5D6570]">
            <span>{got + review > 0 ? `${got} got it · ${review} to review` : "Not started"}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            aria-label={`${c.chapter}: ${pct}% marked on this device`}>
            <div className="h-full rounded-full bg-[#168B59]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Link to={sessionHref({ c: cls, s: subject, ch: c.chapter, type })} aria-label={`${got + review > 0 ? "Continue" : "Practise"}: ${c.chapter}`}
            className={cn(count === 0 && "pointer-events-none opacity-50", got + review > 0 ? BTN_SECONDARY_MD : BTN_PRIMARY_MD)}>
            {got + review > 0 ? "Continue" : "Practise"}
          </Link>
        </div>
      </article>
    </li>
  );
}

export default function PracticeHome() {
  const { uid } = useStudentShell();
  const store = usePracticeProgress(uid);
  const [params, setParams] = useSearchParams();
  const usable = PRACTICE_CLASSES.filter(hasQuestions);
  const pick = (c: string | null) => (c && hasQuestions(c) ? c : null);
  const cls = pick(params.get("class")) ?? pick(store.cls) ?? "10";
  const subjects = SUBJECTS_BY_CLASS[cls] ?? [];
  const subjectParam = params.get("subject");
  const subject = subjects.find((s) => s.toLowerCase() === (subjectParam || "").toLowerCase()) ?? null;
  const type = params.get("type") || null;
  const [query, setQuery] = useState("");
  const chaptersRef = useRef<HTMLDivElement | null>(null);
  const scrollToChapters = useRef(false); // only after the student picks a subject, not on load / back

  const stats = useChapterStats(cls, subject);
  const summary = useMemo(() => summarize(store), [store]);
  const last = store.last;

  const update = (next: Record<string, string | null>, push = true) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: !push });
  };
  const chooseClass = (c: string) => { setPracticeClass(uid, c); setQuery(""); update({ class: c, subject: null, type: null }); };
  const chooseSubject = (s: string) => { scrollToChapters.current = true; setQuery(""); update({ subject: s, type: null }); };
  useEffect(() => {
    if (!subject || !scrollToChapters.current) return;
    scrollToChapters.current = false;
    chaptersRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [subject]);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of stats.data ?? []) for (const t of c.types) m.set(t.name, (m.get(t.name) ?? 0) + t.count);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [stats.data]);
  const q = query.trim().toLowerCase();
  const chapters = (stats.data ?? []).filter((c) => (!q || c.chapter.toLowerCase().includes(q)) && (!type || c.types.some((t) => t.name === type)));
  const statsError = stats.error instanceof NetError ? stats.error.message : stats.error ? NET_ERROR_TEXT.server : null;

  const sidebar = (
    <>
      {last && (
        <SideCard title="Continue practice" icon={<RotateCcw size={16} aria-hidden />} labelledBy="continue-title">
          <p className="text-[13px] font-semibold text-[#1B1B1B]">{last.ch}</p>
          <p className="mt-0.5 text-[12.5px] text-[#5D6570]">Class {last.c} · {last.s} · set {last.page + 1}</p>
          <Link to={sessionHref({ c: last.c, s: last.s, ch: last.ch, type: last.type, page: last.page, q: last.q })} className={cn(BTN_PRIMARY_MD, "mt-3 w-full")}>
            Continue <ArrowRight size={14} aria-hidden />
          </Link>
        </SideCard>
      )}
      <SideCard title="Your practice" icon={<ListChecks size={16} aria-hidden />} labelledBy="yours-title">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[["Today", summary.today], ["Got it", summary.got], ["To review", summary.review]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-[#F5F6F8] px-2 py-2">
              <dt className="text-[11px] font-medium text-[#5D6570]">{l}</dt>
              <dd className="font-halenoir text-[18px] font-extrabold tabular-nums text-[#1B1B1B]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11.5px] text-[#5D6570]">Marked by you, saved on this device.</p>
      </SideCard>
      <SideCard title="How practice works" icon={<Info size={16} aria-hidden />} labelledBy="how-title">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-[#5D6570]">
          <li><b className="text-[#1B1B1B]">NCERT questions</b>, chapter by chapter, 10 at a time.</li>
          <li><b className="text-[#1B1B1B]">Solved examples</b> come with their answers. Most other questions have no answer key — check with your book or teacher.</li>
          <li>Mark each one <b className="text-[#1B1B1B]">"I got it"</b> or <b className="text-[#1B1B1B]">"Review later"</b> to track your progress.</li>
        </ul>
      </SideCard>
    </>
  );

  return (
    <StudentLayout title="Practice" sidebar={sidebar}>
      <HeroBanner tone="emerald" labelledBy="practice-hero"
        aside={(
          <div className="flex flex-wrap gap-2">
            {last && (
              <Link to={sessionHref({ c: last.c, s: last.s, ch: last.ch, type: last.type, page: last.page, q: last.q })} className={ON_DARK_BTN}>
                Continue practice <ArrowRight size={14} aria-hidden />
              </Link>
            )}
            <a href="#subjects" className="inline-flex h-10 items-center rounded-lg border border-white/60 px-4 text-[13px] font-semibold text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white">
              {last ? "Choose a chapter" : "Start practising"}
            </a>
          </div>
        )}>
        <span className={cn(EYEBROW, "bg-white/15 text-white")}><BookOpenCheck size={12} aria-hidden /> NCERT practice</span>
        <h1 id="practice-hero" className="mt-2.5 font-halenoir text-[26px] font-extrabold leading-tight md:text-[32px]">Practice. Improve. Master.</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-white">Build confidence with chapter-wise NCERT questions — exercises, in-text questions and solved examples.</p>
      </HeroBanner>

      <div className="mt-7">
        <h2 className="font-halenoir text-[17px] font-bold text-[#1B1B1B]">Choose your class</h2>
        {usable.length < PRACTICE_CLASSES.length && <p className="mt-0.5 text-[13px] text-[#5D6570]">Class 8 has no questions in our bank yet.</p>}
        <div className="mt-3"><ClassPicker classes={PRACTICE_CLASSES} value={cls} onChange={chooseClass} usable={hasQuestions} unusableTitle="No questions for this class yet" /></div>
      </div>

      <section id="subjects" aria-labelledby="subjects-title" className="mt-7 scroll-mt-20">
        <SectionHeader id="subjects-title" title={`Class ${cls} subjects`} count={subjects.length} dot="#168B59" />
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <li key={s} className="list-none">
              <SubjectCard cls={cls} subject={s} selected={s === subject} onSelect={() => chooseSubject(s)} marked={subjectMarks(store, cls, s)} />
            </li>
          ))}
        </ul>
      </section>

      <div ref={chaptersRef} className="scroll-mt-20">
        {subject ? (
          <section aria-labelledby="chapters-title" className="mt-8">
            <SectionHeader id="chapters-title" title={`${subject} chapters`} count={stats.data ? chapters.length : undefined} dot="#14243A" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-72">
                <label htmlFor="chapter-search" className="sr-only">Search chapters</label>
                <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5D6570]" />
                <input id="chapter-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapters" maxLength={60}
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F5F6F8] pl-9 pr-3 text-[14px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus:border-[#246BCE] focus:bg-white focus:ring-2 focus:ring-[#246BCE]/20" />
              </div>
              {types.length > 1 && (
                <div role="group" aria-label="Question type" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                  {[["", "All types"] as const, ...types.slice(0, 6).map(([t]) => [t, typeLabel(t)] as const)].map(([t, label]) => {
                    const on = (type ?? "") === t;
                    return (
                      <button key={t || "all"} type="button" aria-pressed={on} onClick={() => update({ type: t || null }, false)}
                        className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium",
                          on ? "border-[#14243A] bg-[#14243A] text-white" : "border-[#E5E7EB] bg-white text-[#1B1B1B] hover:border-[#9CA3AF]", FOCUS_RING)}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-4">
              {stats.isPending ? (
                <ul aria-hidden className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => <li key={i} className="h-[154px] list-none rounded-xl border border-[#E5E7EB] bg-white" />)}
                </ul>
              ) : statsError ? (
                <ErrorState message={statsError} onRetry={() => stats.refetch()} />
              ) : chapters.length === 0 ? (
                <EmptyState icon={<Search size={24} aria-hidden />} title={q ? `No chapters match "${query.trim()}"` : "No chapters here yet"}
                  action={q ? <button type="button" onClick={() => setQuery("")} className={BTN_PRIMARY_MD}>Clear search</button> : undefined} />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {chapters.map((c) => {
                    const m = chapterMarks(store, cls, subject, c.chapter);
                    return <ChapterCard key={c.chapter} cls={cls} subject={subject} c={c} type={type} got={m.got} review={m.review} />;
                  })}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <EmptyState className="mt-8" icon={<CheckCircle2 size={24} aria-hidden />} title="Pick a subject to see its chapters"
            body="Every chapter shows how many questions it has and how far you've got." />
        )}
      </div>
    </StudentLayout>
  );
}
