import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Moon,
  Sun,
  Search,
  Upload,
  Eye,
  Download,
  X,
  FileText,
  Image as ImageIcon,
  FileType,
  Trash2,
  ChevronDown,
  Grid as GridIcon,
  Rows,
  Star,
  StarOff,
  Tag,
  SlidersHorizontal,
  Keyboard,
  Pencil,
  Link as LinkIcon,
  Plus,
  Palette,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               Notes (polished)                             */
/* -------------------------------------------------------------------------- */

type Note = {
  id: number;
  name: string;
  size: string;
  date: string; // ISO
  type: string; // mime
  content: string; // object URL
  subjectKey: string; // e.g. "11-Physics"
  pinned?: boolean;
  tags?: string[];
};

type ViewMode = "grid" | "list";

type SortKey = "date" | "name" | "size";

const SUBJECTS: Record<string, string[]> = {
  "9": ["Maths", "Science", "English", "Social Science"],
  "10": ["Maths", "Science", "English", "Social Science"],
  "11": ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
  "12": ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
};

/* --------------------------------- Helpers -------------------------------- */
const prettyType = (mime: string) => {
  if (!mime) return "FILE";
  if (mime.includes("pdf")) return "PDF";
  if (mime.startsWith("image/")) return mime.split("/")[1]?.toUpperCase();
  if (mime.includes("msword") || mime.includes("word")) return "DOC";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "XLS";
  if (mime.includes("text/markdown") || mime.endsWith("markdown")) return "MD";
  if (mime.includes("text")) return "TXT";
  return mime.split("/")[1]?.toUpperCase() || "FILE";
};

const iconFor = (mime: string) => {
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mime.includes("pdf")) return <FileText className="h-5 w-5" />;
  return <FileType className="h-5 w-5" />;
};

const useLocalStorage = <T,>(key: string, initial: T) => {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
};

/* ---------------------------- Accent / Theme map --------------------------- */
const ACCENTS = {
  indigo: {
    grad: "from-indigo-600 via-fuchsia-600 to-sky-500",
    solid: "bg-indigo-600",
    soft: "from-indigo-500 to-fuchsia-500",
  },
  emerald: {
    grad: "from-emerald-600 via-teal-500 to-cyan-500",
    solid: "bg-emerald-600",
    soft: "from-emerald-500 to-teal-500",
  },
  amber: {
    grad: "from-amber-600 via-orange-500 to-rose-500",
    solid: "bg-amber-600",
    soft: "from-amber-500 to-orange-500",
  },
  rose: {
    grad: "from-rose-600 via-pink-500 to-violet-500",
    solid: "bg-rose-600",
    soft: "from-rose-500 to-pink-500",
  },
} as const;

type AccentKey = keyof typeof ACCENTS;

/* ------------------------------- Tiny Components --------------------------- */
function Kbd({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300">
      {children}
    </span>
  );
}

function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <motion.span layout className="inline-flex items-center gap-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-700 dark:text-neutral-200">
      #{label}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded hover:bg-neutral-300/60 dark:hover:bg-neutral-700/60 px-1">×</button>
      )}
    </motion.span>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

export default function NotesSection() {
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("notes:dark", false);
  const [accent, setAccent] = useLocalStorage<AccentKey>("notes:accent", "indigo");
  const [selectedClass, setSelectedClass] = useLocalStorage<string>("notes:class", "");
  const [selectedSubject, setSelectedSubject] = useLocalStorage<string>("notes:subject", "");
  const [searchQuery, setSearchQuery] = useLocalStorage<string>("notes:q", "");
  const [layout, setLayout] = useLocalStorage<ViewMode>("notes:layout", "grid");
  const [notes, setNotes] = useLocalStorage<Note[]>("notes:data", []);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [preview, setPreview] = useState<Note | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [sortKey, setSortKey] = useLocalStorage<SortKey>("notes:sort", "date");
  const [activeTags, setActiveTags] = useLocalStorage<string[]>("notes:activeTags", []);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [clipboardInfo, setClipboardInfo] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ------------------------------- Theme toggle ------------------------------ */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  /* -------------------------------- Drag&Drop -------------------------------- */
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("ring-2", "ring-purple-500");
    };
    const onLeave = () => el.classList.remove("ring-2", "ring-purple-500");
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      onLeave();
      if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]);
    };
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  /* ------------------------------- Keyboard UX ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowPreview(false);
        setRenameId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* -------------------------------- Uploading -------------------------------- */
  const handleUpload = () => {
    if (!selectedClass || !selectedSubject || !file) return alert("⚠️ Select class, subject and a file.");
    let progress = 0;
    const key = `${selectedClass}-${selectedSubject}`;
    const timer = setInterval(() => {
      progress = Math.min(100, progress + 8 + Math.random() * 12);
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(timer);
        const newNote: Note = {
          id: Date.now(),
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          date: new Date().toISOString(),
          type: file.type,
          content: URL.createObjectURL(file),
          subjectKey: key,
          tags: [],
        };
        setNotes((prev) => [newNote, ...prev]);
        setFile(null);
        setUploadProgress(0);
      }
    }, 120);
  };

  const handleView = (note: Note) => {
    setPreview(note);
    setShowPreview(true);
  };

  const handleDownload = (note: Note) => {
    const a = document.createElement("a");
    a.href = note.content;
    a.download = note.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = (note: Note) => {
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (preview?.id === note.id) setShowPreview(false);
  };

  const togglePin = (note: Note) => setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));

  const addTagToNote = (note: Note, tag: string) =>
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, tags: Array.from(new Set([...(n.tags || []), tag])) } : n)));

  const removeTagFromNote = (note: Note, tag: string) =>
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, tags: (n.tags || []).filter((t) => t !== tag) } : n)));

  const clearFilters = () => {
    setSelectedClass("");
    setSelectedSubject("");
    setSearchQuery("");
    setActiveTags([]);
  };

  /* --------------------------------- Derived -------------------------------- */
  const filtered = useMemo(() => {
    const key = selectedClass && selectedSubject ? `${selectedClass}-${selectedSubject}` : null;
    const list = key ? notes.filter((n) => n.subjectKey === key) : [];
    const q = searchQuery.trim().toLowerCase();
    const byQuery = q
      ? list.filter((n) => n.name.toLowerCase().includes(q) || (n.tags || []).some((t) => t.toLowerCase().includes(q)))
      : list;
    const byTags = activeTags.length ? byQuery.filter((n) => activeTags.every((t) => (n.tags || []).includes(t))) : byQuery;
    const sorted = [...byTags].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "size") return parseFloat(b.size) - parseFloat(a.size);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return sorted;
  }, [notes, selectedClass, selectedSubject, searchQuery, sortKey, activeTags]);

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((n) => n.tags || []))).sort(), [notes]);

  /* ---------------------------------- JSX ----------------------------------- */
  return (
    <div className={`relative min-h-screen p-6 transition-colors duration-300 ${darkMode ? "dark bg-neutral-950" : "bg-gradient-to-br from-slate-50 to-indigo-50"}`}>
      {/* Ambient animated blobs */}
      <motion.div
        className={`pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30 bg-gradient-to-br ${ACCENTS[accent].solid}`}
        animate={{ y: [0, 15, 0], opacity: [0.25, 0.35, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30 bg-gradient-to-br ${ACCENTS[accent].solid}`}
        animate={{ y: [0, -12, 0], opacity: [0.25, 0.35, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && preview && (
          <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-neutral-900" initial={{ y: 20, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, scale: 0.98, opacity: 0 }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-100 truncate">
                  {iconFor(preview.type)} <span className="truncate">{preview.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownload(preview)} className="px-3 py-1.5 text-sm rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90">
                    Download
                  </button>
                  <button onClick={() => setShowPreview(false)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto max-h-[78vh]">
                {preview.type.startsWith("image/") ? (
                  <img src={preview.content} alt={preview.name} className="max-w-full h-auto mx-auto rounded-lg" />
                ) : preview.type.includes("pdf") ? (
                  <iframe title="preview" src={preview.content} className="w-full h-[72vh] rounded-lg" />
                ) : (
                  <div className="p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-center text-neutral-500 dark:text-neutral-400">
                    Preview not available for this file type. Download to view.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className={`text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${ACCENTS[accent].grad}`}>
              Notes
            </h1>
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
              <span>Classes</span>
              <span>›</span>
              <span>{selectedClass || "—"}</span>
              <span>›</span>
              <span>{selectedSubject || "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Accent palette toggle */}
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-1">
              {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                <button key={k} onClick={() => setAccent(k)} className={`h-7 w-7 rounded-lg ${ACCENTS[k].solid} ${accent === k ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ring-white/80" : "opacity-80"}`} title={`Accent: ${k}`} />
              ))}
            </div>
            <button onClick={() => setLayout((l) => (l === "grid" ? "list" : "grid"))} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Toggle layout">
              {layout === "grid" ? <Rows className="h-5 w-5" /> : <GridIcon className="h-5 w-5" />}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Toggle theme">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Upload + Filters */}
        <div className="rounded-2xl border-0 shadow-lg bg-white dark:bg-neutral-900">
          <div className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Upload New Notes</h2>
              {(selectedClass || selectedSubject || searchQuery || activeTags.length) && (
                <button onClick={clearFilters} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">Clear filters</button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="mt-1 w-full py-2 px-3 rounded-xl border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100">
                  <option value="">Select Class</option>
                  {[9, 10, 11, 12].map((c) => (
                    <option key={c} value={String(c)}>Class {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedClass} className="mt-1 w-full py-2 px-3 rounded-xl border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 disabled:opacity-60">
                  <option value="">Select Subject</option>
                  {selectedClass && SUBJECTS[selectedClass]?.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">File</label>
                <div ref={dropRef} className="mt-1 flex items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3">
                  <input id="notes-file-input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white dark:file:bg-white dark:file:text-neutral-900 file:px-3 file:py-2" />
                  <button onClick={handleUpload} disabled={!selectedClass || !selectedSubject || !file} className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${ACCENTS[accent].soft} px-4 py-2 text-white disabled:opacity-60`}>
                    <Upload className="h-4 w-4" /> Upload
                  </button>
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div className={`h-full bg-gradient-to-r ${ACCENTS[accent].soft} transition-all`} style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Uploading… {Math.round(uploadProgress)}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Search + sort + tag filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input ref={searchRef} placeholder="Search notes… (press /)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 pl-9 pr-3 py-2 text-neutral-800 dark:text-neutral-100" />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500">Sort</span>
                <div className="relative">
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="appearance-none rounded-xl border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 px-3 py-2 pr-8 text-sm">
                    <option value="date">Newest</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                </div>
              </div>

              {/* Better Tag Filter */}
              <div className="md:col-span-4">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Tag className="h-4 w-4" /> Tags
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) {
                            const v = tagInput.trim();
                            setActiveTags((prev) => Array.from(new Set([...prev, v])));
                            setTagInput("");
                          }
                        }}
                        placeholder="Add filter tag"
                        className="w-32 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => tagInput.trim() && (setActiveTags((p) => Array.from(new Set([...p, tagInput.trim()]))), setTagInput(""))}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white bg-gradient-to-r ${ACCENTS[accent].soft}`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AnimatePresence>
                      {activeTags.map((t) => (
                        <motion.div key={t} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                          <TagChip label={t} onRemove={() => setActiveTags((arr) => arr.filter((x) => x !== t))} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {/* quick-pick from existing tags */}
                    {!activeTags.length && allTags.length > 0 && (
                      <div className="text-xs text-neutral-500">Quick picks:</div>
                    )}
                    {activeTags.length === 0 && allTags.slice(0, 6).map((t) => (
                      <button key={t} onClick={() => setActiveTags((arr) => Array.from(new Set([...arr, t])))} className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {selectedClass && selectedSubject ? (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                Notes for Class {selectedClass} – {selectedSubject}
                <span className="ml-2 align-middle text-sm text-neutral-500">({filtered.length} files)</span>
              </h2>
              {clipboardInfo && <span className="text-xs text-emerald-600 dark:text-emerald-400">{clipboardInfo}</span>}
            </div>

            {filtered.length ? (
              <LayoutGroup>
                <div className={layout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                  {filtered.map((note) => (
                    <motion.div key={note.id} layout whileHover={{ y: -2 }} className={`group rounded-2xl border ${layout === "grid" ? "p-4" : "p-3"} bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-200/60 dark:bg-neutral-700/60">
                            {iconFor(note.type)}
                          </div>
                          <div className="min-w-0">
                            {renameId === note.id ? (
                              <input autoFocus defaultValue={note.name} onBlur={(e) => { setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, name: e.target.value } : n))); setRenameId(null); }} className="w-full rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-sm" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-neutral-800 dark:text-neutral-100 max-w-[16rem]">{note.name}</p>
                                {note.pinned && <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 text-[10px]">PINNED</span>}
                              </div>
                            )}
                            <p className="text-xs text-neutral-500">{prettyType(note.type)} · {note.size} · {new Date(note.date).toLocaleDateString()}</p>
                            {note.tags && note.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {note.tags.map((t) => (
                                  <TagChip key={t} label={t} onRemove={() => removeTagFromNote(note, t)} />
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                placeholder="Add tag"
                                className="w-28 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs"
                                onKeyDown={(e) => {
                                  const v = (e.target as HTMLInputElement).value.trim();
                                  if (e.key === "Enter" && v) {
                                    addTagToNote(note, v);
                                    (e.target as HTMLInputElement).value = "";
                                  }
                                }}
                              />
                              <button onClick={() => setRenameId(note.id)} className="text-xs rounded-md px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"><Pencil className="h-3.5 w-3.5 inline" /> Rename</button>
                              <button onClick={() => navigator.clipboard.writeText(note.content).then(() => { setClipboardInfo("Copied note link"); setTimeout(() => setClipboardInfo(null), 1200); })} className="text-xs rounded-md px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"><LinkIcon className="h-3.5 w-3.5 inline" /> Copy link</button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button title="Pin" onClick={() => togglePin(note)} className="rounded-lg p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-800">{note.pinned ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}</button>
                          <button title="Preview" onClick={() => handleView(note)} className="rounded-lg p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"><Eye className="h-4 w-4" /></button>
                          <button title="Download" onClick={() => handleDownload(note)} className="rounded-lg p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"><Download className="h-4 w-4" /></button>
                          <button title="Delete" onClick={() => handleDelete(note)} className="rounded-lg p-2 hover:bg-red-100/70 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </LayoutGroup>
            ) : (
              <div className="rounded-2xl border-0 shadow-md bg-white dark:bg-neutral-900 p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"><FileText className="h-8 w-8 text-neutral-400" /></div>
                <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-100">No notes found</h3>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">{searchQuery ? "Try a different search term" : "Upload the first note for this subject!"}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-10 grid place-items-center">
            <div className="text-center">
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${ACCENTS[accent].soft} text-white`}><Upload className="h-8 w-8" /></div>
              <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Choose a class & subject to begin</p>
              <p className="text-neutral-500 dark:text-neutral-400">Then drag and drop a file or click Upload.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
