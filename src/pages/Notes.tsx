// /notes — the student's written notes (this device, per user) + the shared class library (read-only).
// Notes from flashcard cards live here too (lib/studentNotes). The old page uploaded files into ONE PUBLIC folder
// per class + subject (everyone's files visible to everyone) and the live bucket has no upload policy, so uploads
// failed; it also flipped the whole app into dark mode. Replaced. The 11 files already in the shared folders stay
// visible below as "Class library".
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Library, NotebookPen, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  LIMITS, createNote, deleteNote, filterNotes, migrateLegacyFlashcardNotes, updateNote, useNotesStore,
  type Note, type NotesFilter, type NotesSort,
} from "@/lib/studentNotes";
import { decksFor, deckHref } from "@/lib/flashcardData";
import { SUBJECTS_BY_CLASS } from "@/lib/practiceApi";
import { HeroBanner, EYEBROW, ON_DARK_BTN } from "@/components/student/Banner";
import { EmptyState, ErrorState, SectionHeader, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const CLASSES = ["6", "7", "8", "9", "10", "11", "12"];
const ALL_SUBJECTS = Array.from(new Set(Object.values(SUBJECTS_BY_CLASS).flat().concat(["Physics", "Chemistry", "Biology"]))).sort();
const INPUT = "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus:border-[#246BCE] focus:ring-2 focus:ring-[#246BCE]/20";
const when = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** cardKey "cls|subject|index|rawId" → link to that card in its deck */
function cardLink(key: string): string | null {
  const [cls, subject, idx, ...rest] = key.split("|");
  const index = Number(idx);
  const deck = decksFor(cls, subject).find((d) => d.index === index);
  if (!deck) return null;
  const pos = deck.cards.findIndex((c) => c.rawId === rest.join("|"));
  return deckHref({ cls, subject, index, card: Math.max(0, pos) });
}

type Draft = { title: string; body: string; cls: string; subject: string; chapter: string; tags: string; pinned: boolean };
const emptyDraft = (n?: Note | null): Draft => ({
  title: n?.title ?? "", body: n?.body ?? "", cls: n?.cls ?? "", subject: n?.subject ?? "", chapter: n?.chapter ?? "",
  tags: (n?.tags ?? []).join(", "), pinned: n?.pinned ?? false,
});

function Editor({ initial, onSave, onCancel }: { initial: Note | null; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(() => emptyDraft(initial));
  const set = (k: keyof Draft, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));
  const empty = !d.title.trim() && !d.body.trim();
  const submit = (e: FormEvent) => { e.preventDefault(); if (!empty) onSave(d); };
  return (
    <form onSubmit={submit} aria-label={initial ? "Edit note" : "New note"} className="rounded-xl border border-[#14243A] bg-white p-4 shadow-[0_0_0_1px_#14243A] sm:p-5">
      <div className="grid gap-3">
        <div>
          <label htmlFor="note-title" className="text-[12.5px] font-semibold text-[#1B1B1B]">Title</label>
          <input id="note-title" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={LIMITS.title} placeholder="e.g. Ohm's law in one line" className={cn(INPUT, "mt-1 h-10")} autoFocus />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="note-class" className="text-[12.5px] font-semibold text-[#1B1B1B]">Class</label>
            <select id="note-class" value={d.cls} onChange={(e) => set("cls", e.target.value)} className={cn(INPUT, "mt-1 h-10")}>
              <option value="">Any</option>
              {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="note-subject" className="text-[12.5px] font-semibold text-[#1B1B1B]">Subject</label>
            <input id="note-subject" list="note-subjects" value={d.subject} onChange={(e) => set("subject", e.target.value.slice(0, 60))} placeholder="e.g. Science" className={cn(INPUT, "mt-1 h-10")} />
            <datalist id="note-subjects">{(d.cls ? SUBJECTS_BY_CLASS[d.cls] ?? [] : ALL_SUBJECTS).map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label htmlFor="note-chapter" className="text-[12.5px] font-semibold text-[#1B1B1B]">Chapter <span className="font-normal text-[#5D6570]">(optional)</span></label>
            <input id="note-chapter" value={d.chapter} onChange={(e) => set("chapter", e.target.value.slice(0, 120))} placeholder="e.g. Electricity" className={cn(INPUT, "mt-1 h-10")} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="note-body" className="text-[12.5px] font-semibold text-[#1B1B1B]">Note</label>
            <span className="text-[11.5px] tabular-nums text-[#5D6570]">{d.body.length.toLocaleString("en-IN")} / {LIMITS.body.toLocaleString("en-IN")}</span>
          </div>
          <textarea id="note-body" value={d.body} onChange={(e) => set("body", e.target.value)} maxLength={LIMITS.body} rows={8}
            placeholder="Write in your own words. Formulas, steps, doubts to ask — anything that helps you revise."
            className={cn(INPUT, "mt-1 resize-y py-2 leading-relaxed")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="note-tags" className="text-[12.5px] font-semibold text-[#1B1B1B]">Tags <span className="font-normal text-[#5D6570]">(comma separated, up to {LIMITS.tags})</span></label>
            <input id="note-tags" value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="formula, revise, doubt" className={cn(INPUT, "mt-1 h-10")} />
          </div>
          <label className="inline-flex h-10 items-center gap-2 text-[13.5px] font-medium text-[#1B1B1B]">
            <input type="checkbox" checked={d.pinned} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4 accent-[#14243A]" /> Pin to top
          </label>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={BTN_SECONDARY_MD}>Cancel</button>
        <button type="submit" disabled={empty} className={cn(BTN_PRIMARY_MD, "disabled:opacity-50")}>{initial ? "Save changes" : "Save note"}</button>
      </div>
    </form>
  );
}

function NoteCard({ n, onEdit, onDelete, onPin }: { n: Note; onEdit: () => void; onDelete: () => void; onPin: () => void }) {
  const meta = [n.cls ? `Class ${n.cls}` : null, n.subject, n.chapter].filter(Boolean).join(" · ");
  const link = n.cardKey ? cardLink(n.cardKey) : null;
  return (
    <article aria-labelledby={`note-${n.id}`} className={cn("flex h-full flex-col rounded-xl border bg-white p-4", n.pinned ? "border-[#F2D9A2]" : "border-[#E5E7EB]")}>
      <div className="flex items-start gap-3">
        {n.subject ? <SubjectTile subject={n.subject} size={36} /> : <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F1F2F4] text-[#14243A]"><NotebookPen size={16} /></span>}
        <div className="min-w-0 flex-1">
          <h3 id={`note-${n.id}`} className="line-clamp-2 font-halenoir text-[15px] font-bold leading-snug text-[#1B1B1B]">{n.title}</h3>
          <p className="mt-0.5 truncate text-[12px] text-[#5D6570]">{meta || "General"}</p>
        </div>
        <button type="button" onClick={onPin} aria-pressed={n.pinned} aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", n.pinned ? "bg-[#FFF8E8] text-[#7A5200]" : "text-[#5D6570] hover:bg-[#F5F6F8]", FOCUS_RING)}>
          {n.pinned ? <Pin size={16} aria-hidden /> : <PinOff size={16} aria-hidden />}
        </button>
      </div>
      {n.body && <p className="mt-3 line-clamp-5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-[#1B1B1B] [overflow-wrap:anywhere]">{n.body}</p>}
      {n.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {n.tags.map((t) => <li key={t} className="rounded-md bg-[#F1F2F4] px-2 py-0.5 text-[11.5px] font-medium text-[#14243A]">#{t}</li>)}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
        <span className="mr-auto text-[11.5px] text-[#5D6570]">Updated {when(n.updatedAt)}</span>
        {link && <Link to={link} className={cn("inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-[#1D4F99] hover:bg-[#EAF1FB]", FOCUS_RING)}>Open card</Link>}
        <button type="button" onClick={onEdit} aria-label={`Edit ${n.title}`} className={cn("grid h-9 w-9 place-items-center rounded-lg text-[#1B1B1B] hover:bg-[#F5F6F8]", FOCUS_RING)}><Pencil size={15} aria-hidden /></button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${n.title}`} className={cn("grid h-9 w-9 place-items-center rounded-lg text-[#A92532] hover:bg-[#FBEBED]", FOCUS_RING)}><Trash2 size={15} aria-hidden /></button>
      </div>
    </article>
  );
}

/* ─────────── shared class library (read-only; files already in the public bucket) ─────────── */
const LIB_SUBJECTS: Record<string, string[]> = {
  "9": ["Maths", "Science", "English", "Social Science"],
  "10": ["Maths", "Science", "English", "Social Science"],
  "11": ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
  "12": ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
};

function ClassLibrary() {
  const [cls, setCls] = useState("10");
  const [subject, setSubject] = useState("Science");
  const prefix = `user-notes/${cls}-${subject}`;
  const files = useQuery({
    queryKey: ["notes-library", prefix],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("notes").list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({
        name: f.name.replace(/^\d{10,}-/, ""),
        url: supabase.storage.from("notes").getPublicUrl(`${prefix}/${f.name}`).data.publicUrl,
        size: (f.metadata as { size?: number } | null)?.size ?? null,
        at: f.created_at ? Date.parse(f.created_at) : null,
      }));
    },
  });
  return (
    <section aria-labelledby="library-title" className="mt-10">
      <SectionHeader id="library-title" title="Class library" dot="#087E8B" />
      <p className="-mt-1 mb-3 text-[12.5px] text-[#5D6570]">Files shared for everyone in a class. Read-only.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="lib-class">Library class</label>
        <select id="lib-class" value={cls} onChange={(e) => { setCls(e.target.value); setSubject(LIB_SUBJECTS[e.target.value][0]); }} className={cn(INPUT, "h-10 w-auto")}>
          {Object.keys(LIB_SUBJECTS).map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <label className="sr-only" htmlFor="lib-subject">Library subject</label>
        <select id="lib-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={cn(INPUT, "h-10 w-auto")}>
          {LIB_SUBJECTS[cls].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {files.isPending ? (
        <ul aria-hidden className="grid gap-2">{[0, 1].map((i) => <li key={i} className="h-14 list-none rounded-xl border border-[#E5E7EB] bg-white" />)}</ul>
      ) : files.isError ? (
        <ErrorState message="The class library couldn't load." onRetry={() => files.refetch()} />
      ) : files.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D5D9DF] bg-[#FAFBFC] px-4 py-5 text-center text-[13px] text-[#5D6570]">No shared files for Class {cls} {subject} yet.</p>
      ) : (
        <ul className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {files.data.map((f) => (
            <li key={f.url} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E6F4F5] text-[#087E8B]"><FileText size={16} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-[#1B1B1B]" title={f.name}>{f.name}</p>
                <p className="text-[12px] text-[#5D6570]">{[f.size != null ? `${Math.max(1, Math.round(f.size / 1024))} KB` : null, f.at ? when(f.at) : null].filter(Boolean).join(" · ")}</p>
              </div>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className={cn(BTN_SECONDARY_MD, "h-9")}>Open <ExternalLink size={14} aria-hidden /></a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function NotesPage() {
  const { uid } = useStudentShell();
  const store = useNotesStore(uid);
  const [params, setParams] = useSearchParams();
  useEffect(() => { migrateLegacyFlashcardNotes(uid); }, [uid]);
  const filter = (["all", "pinned", "flashcards"].includes(params.get("filter") ?? "") ? params.get("filter") : "all") as NotesFilter;
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState<NotesSort>("updated");
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [confirm, setConfirm] = useState<Note | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  const all = useMemo(() => Object.values(store.notes), [store]);
  const list = useMemo(() => filterNotes(all, { q, filter, subject: subject || null, sort }), [all, q, filter, subject, sort]);
  const subjects = useMemo(() => Array.from(new Set(all.map((n) => n.subject).filter((s): s is string => !!s))).sort(), [all]);
  const counts = { all: all.length, pinned: all.filter((n) => n.pinned).length, flashcards: all.filter((n) => n.cardKey || n.tags.includes("flashcards")).length };
  const setFilter = (f: NotesFilter) => { const p = new URLSearchParams(params); if (f === "all") p.delete("filter"); else p.set("filter", f); setParams(p, { replace: true }); };

  const save = (d: Draft) => {
    const payload = { title: d.title, body: d.body, cls: d.cls || null, subject: d.subject.trim() || null, chapter: d.chapter.trim() || null,
      tags: d.tags.split(","), pinned: d.pinned };
    if (editing === "new") {
      if (!createNote(uid, payload)) { setLimitHit(true); return; }
    } else if (editing) updateNote(uid, editing.id, payload);
    setEditing(null);
  };

  const sidebar = (
    <>
      <SideCard title="Your notes" icon={<NotebookPen size={16} aria-hidden />} labelledBy="notes-count">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[["All", counts.all], ["Pinned", counts.pinned], ["Cards", counts.flashcards]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-[#F5F6F8] px-2 py-2">
              <dt className="text-[11px] font-medium text-[#5D6570]">{l}</dt>
              <dd className="font-halenoir text-[18px] font-extrabold tabular-nums text-[#1B1B1B]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11.5px] text-[#5D6570]">Saved on this device, for your account only.</p>
      </SideCard>
      <SideCard title="Good notes" icon={<Library size={16} aria-hidden />} labelledBy="notes-tips">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-[#5D6570]">
          <li>Write it <b className="text-[#1B1B1B]">in your own words</b> — that's what makes it stick.</li>
          <li>Add the <b className="text-[#1B1B1B]">subject and chapter</b> so you can find it before the test.</li>
          <li>Notes you write on a flashcard show up here with a link back to the card.</li>
        </ul>
        <Link to="/dashboard/flashcards" className={cn("mt-2 inline-flex h-9 items-center text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>Open flashcards</Link>
      </SideCard>
    </>
  );

  return (
    <StudentLayout title="My notes" sidebar={sidebar}>
      <HeroBanner tone="navy" labelledBy="notes-hero"
        aside={<button type="button" onClick={() => { setLimitHit(false); setEditing("new"); }} className={ON_DARK_BTN}><Plus size={15} aria-hidden /> New note</button>}>
        <span className={cn(EYEBROW, "bg-white/15 text-white")}><NotebookPen size={12} aria-hidden /> My notes</span>
        <h1 id="notes-hero" className="mt-2.5 font-halenoir text-[26px] font-extrabold leading-tight md:text-[32px]">Your notes, in one place</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-white">Write notes by subject and chapter — the notes you keep on flashcards are here too.</p>
      </HeroBanner>

      {editing && (
        <div className="mt-6">
          {limitHit && <p role="alert" className="mb-2 rounded-lg bg-[#FBEBED] px-3 py-2 text-[13px] font-semibold text-[#A92532]">You've reached {LIMITS.notes} notes on this device. Delete a few to add more.</p>}
          <Editor key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
        </div>
      )}

      <section aria-labelledby="notes-list-title" className="mt-7">
        <SectionHeader id="notes-list-title" title="Notes" count={list.length} dot="#14243A" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Show" className="flex gap-5 border-b border-[#E5E7EB]">
            {([["all", "All"], ["pinned", "Pinned"], ["flashcards", "From flashcards"]] as const).map(([f, label]) => (
              <button key={f} role="tab" type="button" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={cn("relative -mb-px inline-flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] font-semibold",
                  filter === f ? "border-[#A92532] text-[#1B1B1B]" : "border-transparent text-[#5D6570] hover:text-[#1B1B1B]", FOCUS_RING)}>
                {label}<span className="rounded-full bg-[#F1F2F4] px-1.5 text-[11.5px] tabular-nums text-[#5D6570]">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <label htmlFor="notes-search" className="sr-only">Search notes</label>
              <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5D6570]" />
              <input id="notes-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" maxLength={80}
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F5F6F8] pl-9 pr-3 text-[14px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus:border-[#246BCE] focus:bg-white focus:ring-2 focus:ring-[#246BCE]/20" />
            </div>
            {subjects.length > 0 && (
              <>
                <label htmlFor="notes-subject" className="sr-only">Subject</label>
                <select id="notes-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={cn(INPUT, "h-10 w-auto")}>
                  <option value="">All subjects</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            )}
            <label htmlFor="notes-sort" className="sr-only">Sort</label>
            <select id="notes-sort" value={sort} onChange={(e) => setSort(e.target.value as NotesSort)} className={cn(INPUT, "h-10 w-auto")}>
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          {all.length === 0 ? (
            <EmptyState icon={<NotebookPen size={24} aria-hidden />} title="No notes yet"
              body="Write your first note, or add one to any flashcard — it will show up here."
              action={<button type="button" onClick={() => setEditing("new")} className={BTN_PRIMARY_MD}><Plus size={14} aria-hidden /> Write a note</button>} />
          ) : list.length === 0 ? (
            <EmptyState icon={<Search size={24} aria-hidden />} title="No notes match"
              action={<button type="button" onClick={() => { setQ(""); setSubject(""); setFilter("all"); }} className={BTN_PRIMARY_MD}>Clear filters</button>} />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {list.map((n) => (
                <li key={n.id} className="list-none">
                  <NoteCard n={n} onEdit={() => { setLimitHit(false); setEditing(n); window.scrollTo({ top: 0 }); }}
                    onDelete={() => setConfirm(n)} onPin={() => updateNote(uid, n.id, { pinned: !n.pinned }, n.updatedAt)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ClassLibrary />

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>"{confirm?.title}" will be removed from this device. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) { deleteNote(uid, confirm.id); if (editing !== "new" && editing?.id === confirm.id) setEditing(null); } setConfirm(null); }}
              className="bg-[#A92532] hover:bg-[#8F1F2A]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudentLayout>
  );
}
