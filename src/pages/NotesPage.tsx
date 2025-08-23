import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { 
  Plus,
  StickyNote,
  Trash2,
  Pin,
  PinOff,
  Search,
  Sparkles,
  CalendarClock,
  Copy,
  MoreHorizontal,
  Tag,
} from "lucide-react";

/* ========================================================
   Types
======================================================== */

type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  tags?: string[];
  hue?: number; // for a subtle accent per-note
};

/* ========================================================
   Utilities
======================================================== */

const LS_KEY = "a4ai.notes.v2";

const now = () => Date.now();

function uid() {
  // crypto.randomUUID() fallback for older browsers
  // @ts-ignore
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
}

function fmtDate(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "" + ts;
  }
}

const PRESET_TAGS = ["Class 10", "Class 9", "Contest", "Syllabus", "HOTS", "To‑Do"]; 

/* ========================================================
   Component
======================================================== */

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");

  const [notes, setNotes] = useState<Note[]>(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Note[];
        return parsed.sort(byPinnedThen(sort));
      } catch {}
    }
    return [
      {
        id: "seed-1",
        title: "Syllabus pointers",
        body: "Finish Light – numericals.\nAdd HOTS to Set B.",
        createdAt: now() - 86_400_000,
        updatedAt: now() - 86_400_000,
        pinned: true,
        tags: ["Syllabus", "HOTS"],
        hue: 262,
      },
    ];
  });

  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
  }, [notes]);

  // Derived filtered + sorted list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? notes.filter((n) =>
          [n.title, n.body, (n.tags || []).join(" ")] // simple client-side search
            .join(" \n ")
            .toLowerCase()
            .includes(q)
        )
      : [...notes];
    return list.sort(byPinnedThen(sort));
  }, [notes, search, sort]);

  function byPinnedThen(mode: "updated" | "created" | "title") {
    return (a: Note, b: Note) => {
      const pinScore = Number(!!b.pinned) - Number(!!a.pinned);
      if (pinScore !== 0) return pinScore;
      if (mode === "updated") return b.updatedAt - a.updatedAt;
      if (mode === "created") return b.createdAt - a.createdAt;
      return a.title.localeCompare(b.title);
    };
  }

  /* ---------------- Composer actions ---------------- */
  const add = () => {
    if (!title.trim() && !body.trim()) return;
    const newNote: Note = {
      id: uid(),
      title: title.trim() || "Untitled",
      body: body.trim(),
      createdAt: now(),
      updatedAt: now(),
      pinned: false,
      tags: tagDraft,
      hue: Math.floor(Math.random() * 360),
    };
    setNotes((n) => [newNote, ...n]);
    setTitle("");
    setBody("");
    setTagDraft([]);
    // focus body for fast flow
    composerRef.current?.focus();
  };

  const remove = (id: string) => {
    const n = notes.find((x) => x.id === id);
    const ok = window.confirm(`Delete note “${n?.title ?? "Untitled"}”?`);
    if (!ok) return;
    setNotes((list) => list.filter((x) => x.id !== id));
  };

  const togglePin = (id: string) =>
    setNotes((list) =>
      list.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: now() } : n))
    );

  const duplicate = (id: string) =>
    setNotes((list) => {
      const src = list.find((n) => n.id === id);
      if (!src) return list;
      const copy: Note = { ...src, id: uid(), createdAt: now(), updatedAt: now(), pinned: false };
      return [copy, ...list];
    });

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // ignore
    }
  };

  /* ---------------- UI bits ---------------- */
  const headerFX = (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-50/60 via-white to-transparent p-5 dark:from-indigo-950/30 dark:via-transparent">
      {/* Ambient grid */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(400px_200px_at_20%_-10%,black,transparent)]">
        <div className="h-full w-full bg-[linear-gradient(to_right,rgba(0,0,0,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,.06)_1px,transparent_1px)] bg-[size:24px_24px] opacity-[.35] dark:opacity-40" />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lightweight, fast notes for tests, classes, and contests.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <CalendarClock className="h-3.5 w-3.5" /> {new Date().toLocaleDateString()}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, text, or tags…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Sort: {sort === "updated" ? "Recently updated" : sort === "created" ? "Recently created" : "Title A–Z"}
                <MoreHorizontal className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSort("updated")}>Recently updated</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("created")}>Recently created</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("title")}>Title A–Z</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="gap-2" onClick={() => composerRef.current?.focus()}>
            <Sparkles className="h-4 w-4" /> New note
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {headerFX}

        {/* Composer */}
        <Card className="relative mt-6 overflow-hidden border bg-background/70 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_120px_at_30%_0,theme(colors.indigo.500/.08),transparent)]" />
          <div className="relative grid gap-3 md:grid-cols-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <div className="md:col-span-2">
              <Textarea
                ref={composerRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Write your note… (Shift+Enter for newline)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    add();
                  }
                }}
              />
            </div>

            {/* Quick tags */}
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 opacity-60" />
                {PRESET_TAGS.map((t) => {
                  const active = tagDraft.includes(t);
                  return (
                    <Badge
                      key={t}
                      variant={active ? "default" : "secondary"}
                      className="cursor-pointer select-none"
                      onClick={() =>
                        setTagDraft((prev) =>
                          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                        )
                      }
                    >
                      {t}
                    </Badge>
                  );
                })}
                {tagDraft.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setTagDraft([])}>
                    Clear tags
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{title.trim().length + body.trim().length > 0 ? `${(title + body).length} chars` : ""}</span>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Cmd/Ctrl + Enter to add</span>
              <Button className="gap-2" onClick={add}>
                <Plus className="h-4 w-4" /> Add Note
              </Button>
            </div>
          </div>
        </Card>

        {/* List */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Card
                  className="group relative overflow-hidden border p-4 transition-shadow hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,.25)]"
                  style={{
                    // subtle top accent per-note
                    backgroundImage: `linear-gradient(to bottom, hsl(${n.hue} 95% 50% / 0.07), transparent 120px)`
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <StickyNote className="h-4 w-4 text-indigo-500" />
                      <h3 className="truncate font-medium">{n.title}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => togglePin(n.id)} aria-label="Pin">
                            {n.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{n.pinned ? "Unpin" : "Pin"}</TooltipContent>
                      </Tooltip>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="More">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => duplicate(n.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(`${n.title}\n\n${n.body}`)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy text
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(n.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {n.tags && n.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {n.tags.map((t) => (
                        <Badge key={t} variant="outline" className="border-dashed">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {n.body}
                  </p>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {fmtDate(n.updatedAt)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 opacity-70 hover:opacity-100"
                      onClick={() => copyToClipboard(`${n.title}\n\n${n.body}`)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>

                  {/* top-right pin hint glow */}
                  {n.pinned && (
                    <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,theme(colors.yellow.400/.25),transparent_60%)]" />
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="mt-10">
            <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15"
                >
                  <StickyNote className="h-7 w-7 opacity-70" />
                </motion.div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">No notes match your search</h3>
                <p className="text-xs">Try clearing filters or add a new note above.</p>
              </div>
              <div className="mt-2">
                <Button onClick={() => { setSearch(""); composerRef.current?.focus(); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add your first note
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
