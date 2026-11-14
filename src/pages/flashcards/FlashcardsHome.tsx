// /dashboard/flashcards — NCERT flashcards: class → subject → chapter deck. State in the URL (?class&subject).
// Card counts come from the bundled set (lib/flashcardData); progress is this device's (lib/flashcardProgress).
// The old page showed "4.9★ rating", "10k+ learners", "Community notes" — none of that existed. Removed.
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Info, Layers, ListChecks, RotateCcw } from "lucide-react";
import { FLASHCARD_CLASSES, allCards, deckHref, decksFor, subjectTotals, subjectsFor } from "@/lib/flashcardData";
import { deckStats, flashcardSummary, migrateLegacyMastered, useFlashcardProgress } from "@/lib/flashcardProgress";
import { migrateLegacyFlashcardNotes } from "@/lib/studentNotes";
import { HeroBanner, EYEBROW, ON_DARK_BTN } from "@/components/student/Banner";
import { EmptyState, SectionHeader, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { ClassPicker } from "@/components/student/ClassPicker";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { cn } from "@/lib/utils";

const TOTAL_CARDS = allCards().length;

export default function FlashcardsHome() {
  const { uid } = useStudentShell();
  const store = useFlashcardProgress(uid);
  const [params, setParams] = useSearchParams();
  useEffect(() => { migrateLegacyMastered(uid); migrateLegacyFlashcardNotes(uid); }, [uid]);

  const pick = (c: string | null) => (c && FLASHCARD_CLASSES.includes(c) ? c : null);
  const cls = pick(params.get("class")) ?? pick(store.last?.cls ?? null) ?? (FLASHCARD_CLASSES.includes("10") ? "10" : FLASHCARD_CLASSES[0]);
  const subjects = subjectsFor(cls);
  const subjectParam = params.get("subject");
  const subject = subjects.find((s) => s.toLowerCase() === (subjectParam || "").toLowerCase()) ?? (subjects.length === 1 ? subjects[0] : null);
  const decks = subject ? decksFor(cls, subject) : [];
  const summary = useMemo(() => flashcardSummary(store), [store]);
  const last = store.last;

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p);
  };

  const sidebar = (
    <>
      {last && (
        <SideCard title="Continue studying" icon={<RotateCcw size={16} aria-hidden />} labelledBy="fc-continue">
          <p className="truncate text-[13px] font-semibold text-[#1B1B1B]">{decksFor(last.cls, last.subject).find((d) => d.index === last.index)?.name ?? "Your last deck"}</p>
          <p className="mt-0.5 text-[12.5px] text-[#5D6570]">Class {last.cls} · {last.subject} · card {last.card + 1}</p>
          <Link to={deckHref({ cls: last.cls, subject: last.subject, index: last.index, card: last.card })} className={cn(BTN_PRIMARY_MD, "mt-3 w-full")}>
            Continue <ArrowRight size={14} aria-hidden />
          </Link>
        </SideCard>
      )}
      <SideCard title="Your flashcards" icon={<ListChecks size={16} aria-hidden />} labelledBy="fc-yours">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[["Known", summary.known], ["Learning", summary.learning], ["Today", summary.today]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-[#F5F6F8] px-2 py-2">
              <dt className="text-[11px] font-medium text-[#5D6570]">{l}</dt>
              <dd className="font-halenoir text-[18px] font-extrabold tabular-nums text-[#1B1B1B]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11.5px] text-[#5D6570]">Marked by you, saved on this device.</p>
      </SideCard>
      <SideCard title="How flashcards work" icon={<Info size={16} aria-hidden />} labelledBy="fc-how">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-[#5D6570]">
          <li>Read the question, try to answer in your head, then <b className="text-[#1B1B1B]">flip</b>.</li>
          <li>Mark it <b className="text-[#1B1B1B]">"I know this"</b> or <b className="text-[#1B1B1B]">"Still learning"</b> — review the ones you're learning later.</li>
          <li>Write a note on any card; it shows up in <Link to="/notes" className="font-semibold text-[#A92532] hover:underline">My notes</Link>.</li>
        </ul>
      </SideCard>
    </>
  );

  return (
    <StudentLayout title="Flashcards" sidebar={sidebar}>
      <HeroBanner tone="blue" labelledBy="fc-hero"
        aside={(
          <div className="flex flex-wrap gap-2">
            {last && (
              <Link to={deckHref({ cls: last.cls, subject: last.subject, index: last.index, card: last.card })} className={ON_DARK_BTN}>
                Continue <ArrowRight size={14} aria-hidden />
              </Link>
            )}
            <a href="#fc-subjects" className="inline-flex h-10 items-center rounded-lg border border-white/60 px-4 text-[13px] font-semibold text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white">
              Choose a chapter
            </a>
          </div>
        )}>
        <span className={cn(EYEBROW, "bg-white/15 text-white")}><Layers size={12} aria-hidden /> NCERT flashcards</span>
        <h1 id="fc-hero" className="mt-2.5 font-halenoir text-[26px] font-extrabold leading-tight md:text-[32px]">Recall it. Remember it.</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-white">
          {TOTAL_CARDS.toLocaleString("en-IN")} cards from NCERT chapters — flip, check yourself, and keep a note on any card.
        </p>
      </HeroBanner>

      <div className="mt-7">
        <h2 className="font-halenoir text-[17px] font-bold text-[#1B1B1B]">Choose your class</h2>
        <p className="mt-0.5 text-[13px] text-[#5D6570]">Flashcards are ready for Classes {FLASHCARD_CLASSES.join(", ")}.</p>
        <div className="mt-3">
          <ClassPicker idPrefix="fc-class" classes={FLASHCARD_CLASSES} value={cls} onChange={(c) => update({ class: c, subject: null })} />
        </div>
      </div>

      <section id="fc-subjects" aria-labelledby="fc-subjects-title" className="mt-7 scroll-mt-20">
        <SectionHeader id="fc-subjects-title" title={`Class ${cls} subjects`} count={subjects.length} dot="#246BCE" />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((sub) => {
            const t = subjectTotals(cls, sub);
            const known = decksFor(cls, sub).reduce((a, d) => a + deckStats(store, d).known, 0);
            const on = sub === subject;
            return (
              <li key={sub} className="list-none">
                <button type="button" onClick={() => update({ subject: sub })} aria-pressed={on}
                  className={cn("flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left",
                    on ? "border-[#14243A] shadow-[0_0_0_1px_#14243A]" : "border-[#E5E7EB] hover:border-[#CBD0D7] hover:shadow-[0_2px_10px_rgba(20,36,58,0.06)]", FOCUS_RING)}>
                  <SubjectTile subject={sub} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-halenoir text-[15px] font-bold text-[#1B1B1B]">{sub}</span>
                    <span className="mt-0.5 block text-[12.5px] tabular-nums text-[#5D6570]">{t.cards} cards · {t.decks} chapter{t.decks === 1 ? "" : "s"}</span>
                    {known > 0 && <span className="mt-1 block text-[11.5px] font-semibold text-[#0E6B43]">{known} known on this device</span>}
                  </span>
                  <ArrowRight size={16} aria-hidden className="shrink-0 text-[#5D6570]" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {subject ? (
        <section aria-labelledby="fc-decks-title" className="mt-8">
          <SectionHeader id="fc-decks-title" title={`${subject} chapters`} count={decks.length} dot="#14243A" />
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {decks.map((d) => {
              const st = deckStats(store, d);
              const pct = st.total ? Math.round((st.known / st.total) * 100) : 0;
              const started = st.known + st.learning > 0;
              return (
                <li key={d.index} className="list-none">
                  <article className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#CBD0D7]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 min-w-[36px] place-items-center rounded-lg bg-[#EAF1FB] px-2 font-halenoir text-[13px] font-extrabold tabular-nums text-[#1D4F99]">{d.number}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 font-halenoir text-[15px] font-bold leading-snug text-[#1B1B1B]" title={d.name}>{d.name}</h3>
                        <p className="mt-0.5 text-[12.5px] tabular-nums text-[#5D6570]">{st.total} card{st.total === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11.5px] text-[#5D6570]">
                        <span>{started ? `${st.known} known · ${st.learning} learning` : "Not started"}</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                        aria-label={`${d.name}: ${pct}% known on this device`}>
                        <div className="h-full rounded-full bg-[#246BCE]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {st.learning > 0 && (
                        <Link to={`${deckHref({ cls, subject, index: d.index })}&only=learning`} className={BTN_SECONDARY_MD}>Review {st.learning}</Link>
                      )}
                      <Link to={deckHref({ cls, subject, index: d.index })} aria-label={`${started ? "Continue" : "Study"}: ${d.name}`} className={started ? BTN_SECONDARY_MD : BTN_PRIMARY_MD}>
                        {started ? "Continue" : "Study"}
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <EmptyState className="mt-8" icon={<Layers size={24} aria-hidden />} title="Pick a subject to see its chapters"
          body="Every chapter shows how many cards it has and how many you already know." />
      )}
    </StudentLayout>
  );
}
