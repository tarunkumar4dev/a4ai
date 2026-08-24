// src/components/attendance/InstituteAttendanceView.tsx
// ──────────────────────────────────────────────────────────────────────
// v3 fixes:
// 1. Removed the component's own search (the dashboard already has one) →
//    no more double search bar. Calendar is now full width.
// 2. "Select a teacher" → full-width rows, full names visible.
// 3. Batch cards → larger horizontal cards, names fully visible.
// The attendance-sheet screen keeps its own search+filter toolbar (that
// screen needs to filter students; the dashboard search doesn't reach it).
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect } from "react";

/* ═══ TYPES ═══ */
type Status = "present" | "absent" | "leave";
interface TeacherItem { id: string; name: string; email: string; batchCount: number; studentCount: number; }
interface BatchItem { id: string; name: string; classLevel: string; subject: string; studentCount: number; }
interface StudentRow { id: string; name: string; rollNo: string; status: Status; overallPct: number; }

/* ═══ ICONS ═══ */
const I = {
  Back:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Layers:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Chart:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  ChevR:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  ChevL:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Search:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Filter:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Check:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Save:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Undo:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  Clock:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  X:        () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Mail:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
};

/* ═══ DEMO DATA ═══ */
const DEMO_TEACHERS: TeacherItem[] = [
  { id: "t1", name: "Meera Iyer",  email: "meera@a4ai.in", batchCount: 3, studentCount: 95 },
  { id: "t2", name: "Rohan Gupta", email: "rohan@a4ai.in", batchCount: 2, studentCount: 68 },
  { id: "t3", name: "Priya Singh", email: "priya@a4ai.in", batchCount: 4, studentCount: 142 },
  { id: "t4", name: "Amit Saxena", email: "amit@a4ai.in",  batchCount: 2, studentCount: 56 },
];
const DEMO_BATCHES: Record<string, BatchItem[]> = {
  t1: [
    { id: "b1", name: "Class 10 — Physics",  classLevel: "10", subject: "Physics", studentCount: 42 },
    { id: "b2", name: "Class 12 — Physics",  classLevel: "12", subject: "Physics", studentCount: 28 },
    { id: "b3", name: "NEET 2026 — Physics", classLevel: "",   subject: "Physics", studentCount: 25 },
  ],
  t2: [
    { id: "b4", name: "Class 11 — Mathematics", classLevel: "11", subject: "Maths", studentCount: 38 },
    { id: "b5", name: "JEE 2026 — Maths",       classLevel: "",   subject: "Maths", studentCount: 30 },
  ],
  t3: [
    { id: "b6", name: "Class 9 — Science",     classLevel: "9",  subject: "Science",   studentCount: 45 },
    { id: "b7", name: "Class 10 — Chemistry",  classLevel: "10", subject: "Chemistry", studentCount: 35 },
    { id: "b8", name: "Class 8 — Science",     classLevel: "8",  subject: "Science",   studentCount: 40 },
    { id: "b9", name: "NEET 2026 — Chemistry", classLevel: "",   subject: "Chemistry", studentCount: 22 },
  ],
  t4: [
    { id: "b10", name: "Class 11 — English", classLevel: "11", subject: "English", studentCount: 32 },
    { id: "b11", name: "Class 12 — English", classLevel: "12", subject: "English", studentCount: 24 },
  ],
};
const NAMES = ["Aarav Sharma","Diya Patel","Kabir Nair","Ishaan Joshi","Kavya Menon","Rishi Verma","Tanya Bose","Nikhil Pandey","Pooja Thakur","Varun Kapoor","Shreya Nath","Amit Kumar","Neha Agarwal","Arjun Reddy","Ananya Das","Sana Khan","Vikram Rao","Priya Das","Rahul Mehta","Simran Kaur"];

const srand = (s: number) => { const x = Math.sin(s + 1) * 10000; return x - Math.floor(x); };
const makeStudents = (count: number, seed: string): StudentRow[] =>
  NAMES.slice(0, Math.min(count, NAMES.length)).map((name, i) => {
    const r = srand(i + seed.charCodeAt(0));
    const st: Status[] = ["present","present","present","absent","leave"];
    return { id: `s${i}`, name, rollNo: String(i + 1).padStart(2, "0"), status: st[Math.floor(r * 5)], overallPct: Math.floor(65 + r * 30) };
  });

/* ═══ HELPERS ═══ */
const SL: Record<Status, string> = { present: "P", absent: "A", leave: "L" };
const SF: Record<Status, string> = { present: "Present", absent: "Absent", leave: "On Leave" };
const SC: Record<Status, { on: string; bg: string; ring: string; dot: string }> = {
  present: { on: "bg-emerald-500 text-white", bg: "bg-emerald-50/60", ring: "ring-emerald-300", dot: "bg-emerald-500" },
  absent:  { on: "bg-red-500 text-white",     bg: "bg-red-50/60",     ring: "ring-red-300",     dot: "bg-red-500" },
  leave:   { on: "bg-blue-500 text-white",    bg: "bg-blue-50/60",    ring: "ring-blue-300",    dot: "bg-blue-500" },
};
const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

interface Props { teachers?: any[]; batches?: any[]; students?: any[]; }

export default function InstituteAttendanceView(_props: Props) {
  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [batch, setBatch] = useState<BatchItem | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [origRows, setOrigRows] = useState<StudentRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  const [date, setDate] = useState(new Date());
  const [cM, setCM] = useState(new Date().getMonth());
  const [cY, setCY] = useState(new Date().getFullYear());

  // search ONLY exists on the attendance-sheet screen (student filtering)
  const [sheetSearch, setSheetSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const list = DEMO_TEACHERS;

  const cal = useMemo(() => {
    const first = new Date(cY, cM, 1);
    const last = new Date(cY, cM + 1, 0);
    const pad: (number | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) pad.push(d);
    while (pad.length % 7) pad.push(null);
    return pad;
  }, [cM, cY]);
  const isToday = (d: number) => { const n = new Date(); return d === n.getDate() && cM === n.getMonth() && cY === n.getFullYear(); };
  const isSel = (d: number) => d === date.getDate() && cM === date.getMonth() && cY === date.getFullYear();
  const isWE = (d: number) => { const day = new Date(cY, cM, d).getDay(); return day === 0 || day === 6; };

  const openTeacher = useCallback((t: TeacherItem) => { setTeacher(t); setBatch(null); }, []);
  const openBatch = useCallback((b: BatchItem) => {
    setBatch(b);
    const s = makeStudents(b.studentCount, b.id);
    setRows(s); setOrigRows(JSON.parse(JSON.stringify(s)));
    setDirty(false); setSavedAt(""); setSheetSearch(""); setStatusFilter("all");
  }, []);
  const mark = useCallback((id: string, s: Status) => { setRows(p => p.map(r => r.id === id && r.status !== s ? { ...r, status: s } : r)); setDirty(true); }, []);
  const markAll = useCallback(() => { setRows(p => p.map(s => ({ ...s, status: "present" as Status }))); setDirty(true); }, []);
  const undo = useCallback(() => { setRows(JSON.parse(JSON.stringify(origRows))); setDirty(false); }, [origRows]);
  const save = useCallback(() => {
    setSaving(true);
    setTimeout(() => { setOrigRows(JSON.parse(JSON.stringify(rows))); setDirty(false); setSaving(false); setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })); }, 500);
  }, [rows]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (!batch) return; if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (dirty) save(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [batch, dirty, save]);

  const pres = rows.filter(s => s.status === "present").length;
  const abs = rows.filter(s => s.status === "absent").length;
  const lv = rows.filter(s => s.status === "leave").length;
  const pct = rows.length > 0 ? Math.round((pres / rows.length) * 100) : 0;

  const filteredRows = useMemo(() => {
    let f = rows;
    if (statusFilter !== "all") f = f.filter(s => s.status === statusFilter);
    const q = sheetSearch.toLowerCase().trim();
    if (q) f = f.filter(s => s.name.toLowerCase().includes(q) || s.rollNo.includes(q));
    return f;
  }, [rows, statusFilter, sheetSearch]);

  const saveLabel = saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : dirty ? "Unsaved" : "All saved";
  const saveColor = saving || dirty ? "text-amber-600" : "text-emerald-600";

  /* ════ SCREEN 1: CALENDAR (full width, no search) + TEACHERS (full-width rows) ════ */
  if (!teacher) {
    return (
      <div className="space-y-5">
        {/* FIX #1: calendar full width, NO internal search */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="text-[#FF7043]"><I.Calendar /></span> Select date
            </h3>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { if (cM === 0) { setCM(11); setCY(cY - 1); } else setCM(cM - 1); }}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-90 transition-all"><I.ChevL /></button>
              <span className="text-[13px] font-bold text-slate-700 min-w-[84px] text-center">{MONTHS[cM]} {cY}</span>
              <button onClick={() => { if (cM === 11) { setCM(0); setCY(cY + 1); } else setCM(cM + 1); }}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-90 transition-all"><I.ChevR /></button>
              <button onClick={() => { setCM(new Date().getMonth()); setCY(new Date().getFullYear()); setDate(new Date()); }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-200 active:scale-90 transition-all">Today</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map(d => <div key={d} className="text-[11px] font-bold text-slate-400 uppercase py-1.5">{d}</div>)}
            {cal.map((d, i) => d === null ? <div key={i} className="h-10" /> : (
              <button key={i} onClick={() => setDate(new Date(cY, cM, d))}
                className={`h-10 rounded-xl text-[13px] font-bold transition-all active:scale-90 ${
                  isSel(d) ? "bg-[#FF7043] text-white shadow-sm" :
                  isToday(d) ? "bg-orange-50 text-[#FF7043] ring-1 ring-[#FF7043]/30" :
                  isWE(d) ? "text-slate-300 hover:bg-slate-50" : "text-slate-600 hover:bg-slate-50"
                }`}>{d}</button>
            ))}
          </div>
          <p className="text-[12px] font-medium text-slate-400 mt-3 text-center flex items-center justify-center gap-1.5">
            <I.Clock /> {DAYS_FULL[date.getDay()]}, {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {isToday(date.getDate()) && date.getMonth() === new Date().getMonth() && <span className="text-[#FF7043] font-bold">· Today</span>}
          </p>
        </div>

        {/* FIX #2: teachers as full-width rows, full names */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-slate-800">Select a teacher</h3>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{list.length} teachers</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.map(t => (
              <button key={t.id} onClick={() => openTeacher(t)}
                className="bg-white rounded-2xl p-4 card-shadow border border-slate-50 text-left flex items-center gap-3.5 group hover:shadow-md hover:-translate-y-0.5 transition-all w-full">
                <div className="w-12 h-12 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-bold text-[15px] shrink-0 group-hover:scale-105 transition-transform">
                  {initials(t.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 truncate">{t.name}</p>
                  <p className="text-[11.5px] text-slate-400 font-medium flex items-center gap-1 truncate"><I.Mail /> {t.email}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.batchCount} batches · {t.studentCount} students</p>
                </div>
                <span className="text-slate-300 group-hover:text-[#FF7043] shrink-0 transition-colors"><I.ChevR /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ════ SCREEN 2: BATCHES (larger horizontal cards, full names) ════ */
  if (!batch) {
    const tBatches = DEMO_BATCHES[teacher.id] || [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setTeacher(null)}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-90 transition-all shrink-0"><I.Back /></button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <button onClick={() => setTeacher(null)} className="hover:text-slate-600 transition-colors">Teachers</button>
              <span>›</span><span className="text-slate-600 truncate">{teacher.name}</span>
            </p>
            <h2 className="text-lg font-black text-slate-800 leading-tight truncate">{teacher.name}</h2>
            <p className="text-[12px] text-slate-500 font-medium truncate">{teacher.email} · {tBatches.length} batches</p>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-bold text-slate-400 mb-3">Assigned classes / batches</p>
          {/* FIX #3: bigger horizontal cards — icon left, text right, name fully visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tBatches.map(b => (
              <button key={b.id} onClick={() => openBatch(b)}
                className="bg-white rounded-2xl p-4 card-shadow border border-slate-50 text-left group hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3.5 w-full">
                <div className="w-12 h-12 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0"><I.Layers /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 truncate">{b.name}</p>
                  <p className="text-[11.5px] text-slate-400 font-medium truncate">
                    {b.classLevel ? `Class ${b.classLevel}` : "Competitive"}{b.subject ? ` · ${b.subject}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{b.studentCount} students</p>
                </div>
                <span className="text-slate-300 group-hover:text-[#FF7043] shrink-0 transition-colors"><I.ChevR /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ════ SCREEN 3: ATTENDANCE SHEET ════ */
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => { if (!dirty || confirm("Unsaved changes. Go back?")) setBatch(null); }}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-90 transition-all shrink-0 mt-0.5"><I.Back /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 overflow-hidden">
              <button onClick={() => { setTeacher(null); setBatch(null); }} className="hover:text-slate-600 shrink-0">Teachers</button>
              <span className="shrink-0">›</span>
              <button onClick={() => { if (!dirty || confirm("Unsaved changes. Go back?")) setBatch(null); }} className="hover:text-slate-600 shrink-0 truncate max-w-[80px]">{teacher.name}</button>
              <span className="shrink-0">›</span><span className="text-slate-600 truncate">{batch.name}</span>
            </p>
            <h2 className="text-lg font-black text-slate-800 leading-tight truncate">{batch.name}</h2>
            <p className="text-[12px] text-slate-500 font-medium">{teacher.name} · {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {rows.length} students</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={undo} disabled={!dirty} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-[12px] font-bold text-slate-600 hover:bg-slate-200 active:scale-95 disabled:opacity-30 transition-all"><I.Undo /> Undo</button>
          <button onClick={markAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-[12px] font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"><I.Check /> All Present</button>
          <button onClick={save} disabled={!dirty || saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white active:scale-95 disabled:opacity-30 transition-all hover:brightness-110" style={{ background: "linear-gradient(135deg, #FF7043, #F4511E)" }}>
            {saving ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <I.Save />} Save
          </button>
          <span className={`text-[11px] font-bold ${saveColor} flex items-center gap-1 ml-1`}><span className="w-1.5 h-1.5 rounded-full bg-current" /> {saveLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[{ l: "Present", v: pres, c: "text-emerald-600" }, { l: "Absent", v: abs, c: "text-red-500" }, { l: "On leave", v: lv, c: "text-blue-500" }, { l: "Attendance", v: `${pct}%`, c: "text-[#FF7043]" }].map((s, i) => (
          <div key={i} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 card-shadow border border-slate-50 text-center">
            <p className={`text-xl sm:text-2xl font-black stat-number ${s.c}`}>{s.v}</p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl card-shadow border border-slate-50 overflow-hidden">
        {/* sheet-only search + filter (this one IS needed — filters students in this class) */}
        <div className="flex items-center gap-2 flex-wrap p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 flex-1 min-w-[140px] max-w-xs">
            <span className="text-slate-400 shrink-0"><I.Search /></span>
            <input type="text" placeholder="Search student or roll no…" value={sheetSearch} onChange={e => setSheetSearch(e.target.value)} className="bg-transparent outline-none text-[12px] font-bold text-slate-700 placeholder-slate-400 w-full min-w-0" />
            {sheetSearch && <button onClick={() => setSheetSearch("")} className="text-slate-400 hover:text-slate-600 shrink-0"><I.X /></button>}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <span className="text-slate-400 shrink-0"><I.Filter /></span>
            {(["all","present","absent","leave"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 shrink-0 ${statusFilter === f ? "text-white shadow-sm" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`} style={statusFilter === f ? { background: "#FF7043" } : undefined}>{f === "all" ? "All" : SF[f]}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 480 }}>
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 pl-4 w-10">#</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5">Student</th>
                <th className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 w-[140px]">Status</th>
                <th className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 pr-4 w-16">Overall %</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((s, idx) => {
                const c = SC[s.status];
                return (
                  <tr key={s.id} className={`border-b border-slate-50 last:border-none transition-colors ${c.bg}`}>
                    <td className="py-2.5 pl-4"><span className="flex items-center gap-1.5"><span className="text-[11px] font-bold text-slate-400">{idx + 1}</span><span className={`w-1 h-5 rounded-full ${c.dot} opacity-60`} /></span></td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">{initials(s.name)}</div>
                        <div className="min-w-0"><p className="text-[12px] font-bold text-slate-800 leading-tight truncate">{s.name}</p><p className="text-[10px] text-slate-400">Roll {s.rollNo}</p></div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-center gap-1.5">
                        {(["present","absent","leave"] as Status[]).map(st => {
                          const active = s.status === st; const stc = SC[st];
                          return <button key={st} onClick={() => mark(s.id, st)} title={SF[st]} className={`w-9 h-9 rounded-lg font-black text-[12px] transition-all active:scale-90 shrink-0 ${active ? `${stc.on} shadow-sm ring-2 ${stc.ring}` : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>{SL[st]}</button>;
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={`text-[12px] font-black stat-number ${s.overallPct >= 75 ? "text-emerald-600" : s.overallPct >= 50 ? "text-amber-600" : "text-red-500"}`}>{s.overallPct}%</span>
                      <span className="block text-[8px] font-bold text-slate-400">overall</span>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[13px] text-slate-400 font-medium">No students match</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0"><I.Chart /></div>
          <h3 className="text-[14px] font-bold text-slate-800">Class analytics</h3>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-bold text-slate-400">Today's breakdown</span><span className="text-[11px] font-black text-slate-700 stat-number">{pct}%</span></div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
            {rows.length > 0 && (<><div className="h-full bg-emerald-500" style={{ width: `${(pres / rows.length) * 100}%` }} /><div className="h-full bg-blue-500" style={{ width: `${(lv / rows.length) * 100}%` }} /><div className="h-full bg-red-500" style={{ width: `${(abs / rows.length) * 100}%` }} /></>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mb-5">
          {[{ l: "Present", n: pres, c: "bg-emerald-500" }, { l: "Absent", n: abs, c: "bg-red-500" }, { l: "On leave", n: lv, c: "bg-blue-500" }].map(x => (
            <div key={x.l} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${x.c}`} /><span className="text-[11px] font-bold text-slate-500">{x.l}: {x.n}</span></div>
          ))}
        </div>
        <p className="text-[11px] font-bold text-slate-500 mb-2">This week</p>
        <div className="flex items-end gap-1.5 h-20">
          {["Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => {
            const v = [88,92,78,95,85,70][i];
            return <div key={d} className="flex-1 flex flex-col items-center gap-0.5 group"><span className="text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity stat-number">{v}%</span><div className="w-full max-w-[18px] rounded-t-sm group-hover:opacity-80 transition-opacity" style={{ height: `${v}%`, background: v >= 85 ? "#10b981" : v >= 70 ? "#f59e0b" : "#ef4444" }} /><span className="text-[8px] font-bold text-slate-400">{d}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}