// /dashboard/flashcards/deck?class&subject&chapter[&card][&only=learning] — one chapter's cards.
// Position lives in the URL (refresh / back / a second tab land on the same card). Flip with a click or Space;
// "I know this" / "Still learning" are the student's own marks, saved on this device (lib/flashcardProgress).
// A note can be written on every card (lib/studentNotes) and shows up in My notes. No animation (lite mode).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpenCheck, Check, ChevronLeft, ChevronRight, Info, Layers, NotebookPen, PartyPopper, RotateCcw, Shuffle } from "lucide-react";
import MathText from "@/components/MathText";
import { deckFor, deckHref, decksFor, type Card } from "@/lib/flashcardData";
import {
  clearCardState, deckStats, migrateLegacyMastered, setCardState, setLastDeck, useFlashcardProgress, type CardState,
} from "@/lib/flashcardProgress";
import { cardNote, migrateLegacyFlashcardNotes, setCardNote, useNotesStore } from "@/lib/studentNotes";
import { EmptyState, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { cn } from "@/lib/utils";

const int = (v: string | null) => Math.max(0, Number.parseInt(v || "0", 10) || 0);
const TYPE_LABEL: Record<string, string> = {
  definition: "Definition", formula: "Formula", reaction: "Reaction", concept: "Concept", comparison: "Comparison",
  assumption: "Assumption", fact: "Fact", theorem: "Theorem", axiom: "Axiom", postulate: "Postulate", true_false: "True or false", property: "Property",
};

function CardFace({ card, flipped, onFlip }: { card: Card; flipped: boolean; onFlip: () => void }) {
  return (
    <button type="button" onClick={onFlip} aria-label={flipped ? "Show the question" : "Show the answer"}
      className={cn("block w-full rounded-xl border p-5 text-left sm:p-7", flipped ? "border-[#BFD3F2] bg-[#F5F9FF]" : "border-[#E5E7EB] bg-white hover:border-[#CBD0D7]", FOCUS_RING)}>
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[11.5px] font-semibold", flipped ? "bg-[#246BCE] text-white" : "bg-[#14243A] text-white")}>
          {flipped ? "Answer" : "Question"}
        </span>
        <span className="inline-flex h-6 items-center rounded-md bg-[#F1F2F4] px-2 text-[11.5px] font-semibold text-[#14243A]">{TYPE_LABEL[card.type] ?? card.type}</span>
        <span className="ml-auto text-[12px] text-[#5D6570]">{flipped ? "Tap to see the question" : "Tap to flip"}</span>
      </div>
      <div className="flex min-h-[200px] flex-col justify-center py-5">
        {!flipped ? (
          <>
            {card.title && <p className="mb-2 text-[13px] font-semibold text-[#5D6570]">{card.title}</p>}
            <div className="break-words text-[19px] font-semibold leading-[1.55] text-[#1B1B1B] [overflow-wrap:anywhere] sm:text-[21px]"><MathText text={card.front} /></div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="whitespace-pre-line break-words text-[16px] leading-[1.7] text-[#1B1B1B] [overflow-wrap:anywhere]"><MathText text={card.back} /></div>
            {card.formula && (
              <p className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 font-mono text-[14px] text-[#14243A] [overflow-wrap:anywhere]">
                <MathText text={card.formula} />{card.units ? <span className="ml-2 font-sans text-[12.5px] text-[#5D6570]">({card.units})</span> : null}
              </p>
            )}
            {card.note && <p className="text-[13.5px] text-[#5D6570]"><b className="text-[#1B1B1B]">Note:</b> <MathText text={card.note} /></p>}
            {card.examples && <p className="text-[13.5px] text-[#5D6570]"><b className="text-[#1B1B1B]">Example:</b> <MathText text={card.examples} /></p>}
          </div>
        )}
      </div>
    </button>
  );
}

function CardNote({ uid, card, meta }: { uid: string | null; card: Card; meta: { cls: string; subject: string; chapter: string } }) {
  const notes = useNotesStore(uid);
  const saved = cardNote(notes, card.key)?.body ?? "";
  const [text, setText] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the typed text not yet written; written at once when the card changes, the page hides or unloads
  const pending = useRef<{ key: string; value: string; write: (v: string) => void } | null>(null);
  useEffect(() => { setText(saved); setStatus("idle"); }, [card.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = useCallback((value: string) => {
    setCardNote(uid, card.key, { ...meta, title: card.front.slice(0, 80) }, value);
    pending.current = null;
    setStatus("saved");
  }, [uid, card.key, card.front, meta]);
  const flushPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) p.write(p.value);
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", flushPending);
    return () => { window.removeEventListener("pagehide", flushPending); flushPending(); };
  }, [card.key, flushPending]);
  const onChange = (v: string) => {
    setText(v);
    setStatus("saving");
    const key = card.key, m = { ...meta, title: card.front.slice(0, 80) };
    pending.current = { key, value: v, write: (val) => setCardNote(uid, key, m, val) };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(v), 600);
  };
  return (
    <section aria-labelledby="card-note-title" className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="card-note-title" className="flex items-center gap-2 text-[14px] font-semibold text-[#1B1B1B]"><NotebookPen size={15} aria-hidden /> My note for this card</h2>
        <span className="text-[12px] text-[#5D6570]" role="status">{status === "saving" ? "Saving…" : status === "saved" ? "Saved on this device" : saved ? "Saved on this device" : ""}</span>
      </div>
      <label htmlFor="card-note" className="sr-only">My note for this card</label>
      <textarea id="card-note" value={text} onChange={(e) => onChange(e.target.value)} onBlur={() => { if (status === "saving") { if (timer.current) clearTimeout(timer.current); flush(text); } }}
        rows={3} maxLength={4000} placeholder="Write it in your own words, a trick to remember, or a doubt to ask…"
        className="mt-2 w-full resize-y rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2 text-[14px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus:border-[#246BCE] focus:bg-white focus:ring-2 focus:ring-[#246BCE]/20" />
      <Link to="/notes?filter=flashcards" className={cn("mt-1 inline-flex h-8 items-center text-[12.5px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>All my notes</Link>
    </section>
  );
}

export default function FlashcardDeckPage() {
  const { uid } = useStudentShell();
  const store = useFlashcardProgress(uid);
  const [params, setParams] = useSearchParams();
  useEffect(() => { migrateLegacyMastered(uid); migrateLegacyFlashcardNotes(uid); }, [uid]);

  const cls = params.get("class") || "";
  const subject = params.get("subject") || "";
  const index = int(params.get("chapter")) || 1;
  const onlyLearning = params.get("only") === "learning";
  const deck = deckFor(cls, subject, index);
  // "only learning" works on the list as it was when the review started, so marking a card doesn't make it vanish
  const [reviewSet, setReviewSet] = useState<string[] | null>(null);
  useEffect(() => {
    if (!deck) return;
    setReviewSet(onlyLearning ? deck.cards.filter((c) => store.cards[c.key]?.s === "learning").map((c) => c.key) : null);
  }, [deck, onlyLearning]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = useMemo(() => (!deck ? [] : reviewSet ? deck.cards.filter((c) => reviewSet.includes(c.key)) : deck.cards), [deck, reviewSet]);
  const ci = Math.min(int(params.get("card")), Math.max(0, cards.length - 1));
  const card = cards[ci] ?? null;
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => setFlipped(false), [card?.key]);

  const go = useCallback((next: number, opts: { only?: boolean } = {}) => {
    const p = new URLSearchParams(params);
    p.set("card", String(next));
    if (opts.only === true) p.set("only", "learning");
    if (opts.only === false) p.delete("only");
    setParams(p, { replace: opts.only === undefined });
  }, [params, setParams]);

  useEffect(() => {
    if (deck && card) setLastDeck(uid, { cls, subject, index, card: onlyLearning ? 0 : ci });
  }, [deck, card, uid, cls, subject, index, ci, onlyLearning]);

  const next = useCallback(() => (ci < cards.length - 1 ? go(ci + 1) : setFinished(true)), [ci, cards.length, go]);
  const prev = useCallback(() => { if (ci > 0) go(ci - 1); }, [ci, go]);
  const mark = useCallback((s: CardState) => {
    if (!card) return;
    setCardState(uid, card.key, s);
    next();
  }, [card, uid, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (finished || !card || (t && t.closest("input, textarea, select, [contenteditable]")) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === " " && !(t && t.closest("button, a"))) { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key.toLowerCase() === "k") mark("known");
      else if (e.key.toLowerCase() === "l") mark("learning");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, card, next, prev, mark]);

  const stats = deck ? deckStats(store, deck) : null;
  const decks = deck ? decksFor(cls, deck.subject) : [];
  const nextDeck = deck ? decks.find((d) => d.index > deck.index) : null;
  const state = card ? store.cards[card.key]?.s ?? null : null;
  const pct = stats && stats.total ? Math.round((stats.known / stats.total) * 100) : 0;
  const home = `/dashboard/flashcards?class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(subject)}`;

  const sidebar = deck && stats ? (
    <>
      <SideCard title="This deck" labelledBy="deck-stats">
        <div className="flex items-center gap-3">
          <SubjectTile subject={deck.subject} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1B1B1B]" title={deck.name}>{deck.name}</p>
            <p className="text-[12px] text-[#5D6570]">Class {cls} · {deck.subject} · chapter {deck.number}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Known", stats.known, "#0E6B43"], ["Learning", stats.learning, "#7A5200"], ["New", stats.fresh, "#1B1B1B"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-lg bg-[#F5F6F8] px-2 py-2">
              <dt className="text-[11px] font-medium text-[#5D6570]">{l}</dt>
              <dd className="font-halenoir text-[17px] font-extrabold tabular-nums" style={{ color: c as string }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11.5px] text-[#5D6570]">Marked by you, saved on this device.</p>
      </SideCard>
      <SideCard title="Shortcuts" labelledBy="deck-keys">
        <ul className="space-y-1 text-[12.5px] text-[#5D6570]">
          {[["Space", "flip"], ["→ / ←", "next / previous"], ["K", "I know this"], ["L", "still learning"]].map(([k, v]) => (
            <li key={k}><kbd className="rounded border border-[#D5D9DF] px-1.5 text-[11.5px] text-[#1B1B1B]">{k}</kbd> {v}</li>
          ))}
        </ul>
      </SideCard>
      {decks.length > 1 && (
        <SideCard title="Chapters" labelledBy="deck-list">
          <ol className="max-h-[320px] space-y-0.5 overflow-y-auto">
            {decks.map((d) => {
              const s = deckStats(store, d);
              return (
                <li key={d.index}>
                  <Link to={deckHref({ cls, subject: d.subject, index: d.index })} aria-current={d.index === deck.index ? "page" : undefined}
                    className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]", d.index === deck.index ? "bg-[#EAF1FB] font-semibold text-[#1D4F99]" : "text-[#1B1B1B] hover:bg-[#F5F6F8]", FOCUS_RING)}>
                    <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-[#5D6570]">{d.number}</span>
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-[#5D6570]">{s.known}/{s.total}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </SideCard>
      )}
    </>
  ) : undefined;

  if (!deck) {
    return (
      <StudentLayout title="Flashcards">
        <EmptyState icon={<Info size={24} aria-hidden />} title="This deck couldn't be found"
          body="The link may be old. Pick a class, subject and chapter to start." action={<Link to="/dashboard/flashcards" className={BTN_PRIMARY_MD}>Go to Flashcards</Link>} />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title={`${deck.name} · Flashcards`} sidebar={sidebar}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[13px] text-[#5D6570]">
        <Link to="/dashboard/flashcards" className={cn("rounded font-medium hover:text-[#1B1B1B]", FOCUS_RING)}>Flashcards</Link>
        <ChevronRight size={14} aria-hidden />
        <Link to={home} className={cn("rounded font-medium hover:text-[#1B1B1B]", FOCUS_RING)}>Class {cls} · {deck.subject}</Link>
        <ChevronRight size={14} aria-hidden />
        <span className="truncate text-[#1B1B1B]" aria-current="page">{deck.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-halenoir text-[22px] font-extrabold leading-tight md:text-[26px]">{deck.name}</h1>
        <p className="text-[13px] tabular-nums text-[#5D6570]">{onlyLearning ? "Reviewing still-learning cards" : `${stats!.known} of ${stats!.total} known`}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}% of this deck known`}>
        <div className="h-full rounded-full bg-[#246BCE]" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-5">
        {finished || cards.length === 0 ? (
          <section aria-labelledby="deck-done" className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-center">
            {cards.length === 0 ? <BookOpenCheck size={28} aria-hidden className="mx-auto text-[#0E6B43]" /> : <PartyPopper size={28} aria-hidden className="mx-auto text-[#A92532]" />}
            <h2 id="deck-done" className="mt-2 font-halenoir text-[20px] font-extrabold">{cards.length === 0 ? "Nothing left to review" : onlyLearning ? "Review done" : "Deck finished"}</h2>
            <p className="mt-1 text-[13.5px] text-[#5D6570]">
              <b className="text-[#0E6B43]">{stats!.known} known</b> · <b className="text-[#7A5200]">{stats!.learning} still learning</b> · {stats!.fresh} not marked
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {stats!.learning > 0 && (
                <button type="button" onClick={() => { setFinished(false); go(0, { only: true }); }} className={BTN_SECONDARY_MD}><RotateCcw size={14} aria-hidden /> Review {stats!.learning} still learning</button>
              )}
              <button type="button" onClick={() => { setFinished(false); go(0, { only: false }); }} className={BTN_SECONDARY_MD}><Shuffle size={14} aria-hidden /> Go through all again</button>
              {nextDeck ? (
                <Link to={deckHref({ cls, subject: deck.subject, index: nextDeck.index })} onClick={() => setFinished(false)} className={BTN_PRIMARY_MD}>Next chapter <ChevronRight size={14} aria-hidden /></Link>
              ) : (
                <Link to={home} className={BTN_PRIMARY_MD}>All chapters</Link>
              )}
            </div>
          </section>
        ) : card && (
          <>
            <div className="mb-2 flex items-center justify-between text-[13px] text-[#5D6570]">
              <span className="tabular-nums">Card {ci + 1} of {cards.length}</span>
              {state && <span className={cn("font-semibold", state === "known" ? "text-[#0E6B43]" : "text-[#7A5200]")}>{state === "known" ? "You know this" : "Still learning"}</span>}
            </div>
            <CardFace card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="How did you do?">
              <button type="button" onClick={() => mark("learning")} aria-pressed={state === "learning"}
                className={cn("inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border text-[14px] font-semibold",
                  state === "learning" ? "border-[#7A5200] bg-[#7A5200] text-white" : "border-[#F2D9A2] bg-white text-[#7A5200] hover:bg-[#FFF8E8]", FOCUS_RING)}>
                <RotateCcw size={16} aria-hidden /> Still learning
              </button>
              <button type="button" onClick={() => mark("known")} aria-pressed={state === "known"}
                className={cn("inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border text-[14px] font-semibold",
                  state === "known" ? "border-[#0E6B43] bg-[#0E6B43] text-white" : "border-[#BFE3CF] bg-white text-[#0E6B43] hover:bg-[#F3FAF6]", FOCUS_RING)}>
                <Check size={16} aria-hidden /> I know this
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={prev} disabled={ci === 0} className={cn(BTN_SECONDARY_MD, "h-11 disabled:opacity-40")}><ChevronLeft size={16} aria-hidden /> Previous</button>
              {state && <button type="button" onClick={() => clearCardState(uid, card.key)} className={cn("h-11 rounded-lg px-2 text-[13px] font-medium text-[#5D6570] underline underline-offset-2", FOCUS_RING)}>Clear mark</button>}
              <button type="button" onClick={next} className={cn(BTN_PRIMARY_MD, "h-11")}>{ci < cards.length - 1 ? "Next" : "Finish"} <ChevronRight size={16} aria-hidden /></button>
            </div>
            <div className="mt-5"><CardNote uid={uid} card={card} meta={{ cls, subject: deck.subject, chapter: deck.name }} /></div>
          </>
        )}
      </div>
      <Link to={home} className={cn("mt-6 inline-flex h-10 items-center gap-1.5 rounded-lg text-[13px] font-semibold text-[#5D6570] hover:text-[#1B1B1B] lg:hidden", FOCUS_RING)}>
        <Layers size={14} aria-hidden /> All chapters
      </Link>
    </StudentLayout>
  );
}
