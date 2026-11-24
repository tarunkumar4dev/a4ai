// Student pieces shared by the views: flag chips and the student detail drawer.

import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Flame, MessageCircle, X } from "lucide-react";
import { shortDate, type StudentRow } from "@/lib/teacherAnalytics";
import { useBackToClose } from "@/hooks/useBackToClose";
import { openWhatsApp } from "@/lib/whatsapp";
import { Avatar, Ring } from "./kit";
import { ATT_COLORS, ATT_LABELS, RISK_COLORS, RISK_LABELS, btnDark, btnGhost, fmtPct, plural, scoreColor } from "./theme";
import type { AnalyticsModel } from "./model";

export function FlagChips({ row, target, pass }: { row: StudentRow; target: number; pass: number }) {
  const chips: React.ReactNode[] = [];
  if (row.flags.includes("absent-streak"))
    chips.push(<span key="s" className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
      <Flame className="h-3 w-3" aria-hidden="true" />Absent {row.att!.absentStreak} in a row</span>);
  if (row.flags.includes("low-attendance"))
    chips.push(<span key="a" className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
      Attendance {row.att!.pct}% (&lt; {target}%)</span>);
  if (row.flags.includes("low-marks"))
    chips.push(<span key="m" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
      Marks {row.marks!.avg}% (&lt; {pass}%)</span>);
  if (!chips.length)
    chips.push(<span key="ok" className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.risk === "ok"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>{RISK_LABELS[row.risk]}</span>);
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

export function StudentDrawer({ row, m, onClose }: { row: StudentRow | null; m: AnalyticsModel; onClose: () => void }) {
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = !!row;
  useBackToClose(open, onClose, "analytics-student");

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [open, onClose]);

  const records = useMemo(() => (row?.studentId
    ? m.attRecords.filter((r) => r.studentId === row.studentId).sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId))
    : []), [row, m.attRecords]);
  const results = useMemo(() => (row
    ? m.results.filter((r) => r.personKey === row.key).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    : []), [row, m.results]);
  if (!row) return null;

  const counts = records.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  const parent = row.studentId ? m.roster.find((s) => s.id === row.studentId) : undefined;
  const a = row.att;
  const mk = row.marks;

  const message = () => {
    const parts = [`Hello${parent?.parentName ? ` ${parent.parentName}` : ""}, an update about ${row.name}`];
    const facts: string[] = [];
    if (a?.pct != null) facts.push(`attendance ${a.pct}% (${a.attended} of ${plural(a.total, "class", "classes")})`);
    if (mk) facts.push(`average marks ${mk.avg}% over ${plural(mk.count, "assessment")}`);
    let text = `${parts[0]}${facts.length ? `: ${facts.join(", ")}` : ""}.`;
    if (a && a.absentStreak >= 2) text += ` ${row.name} was absent in the last ${a.absentStreak} classes.`;
    return `${text} Please get in touch if you have any questions.`;
  };

  // above the dashboard header (z-150) and sidebar (z-200); inside .dashboard-root so dark mode still applies
  const host = (document.querySelector(".dashboard-root") as HTMLElement | null) ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="analytics-student-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40" tabIndex={-1} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-[#0f0f0f] dark:text-slate-100">
        <div className="relative overflow-hidden border-b border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 px-5 pb-5 pt-4 text-slate-900 dark:border-orange-500/20 dark:from-orange-950/60 dark:via-amber-950/30 dark:to-rose-950/50 dark:text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={row.name} seed={row.key} size="h-12 w-12 text-sm ring-2 ring-white" />
              <div className="min-w-0">
                <h2 id="analytics-student-title" className="truncate text-lg font-black">{row.name}</h2>
                <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {[row.rollNo && `Roll ${row.rollNo}`, row.batchName, row.guest && "Guest (open link)"].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close student details"
              className="rounded-xl bg-white/80 p-2 text-slate-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:bg-white/10 dark:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-800 dark:bg-white/10 dark:text-white">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS[row.risk] }} aria-hidden="true" />{RISK_LABELS[row.risk]}
          </span>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
              <Ring value={a?.pct ?? null} color="#10b981" size={54} stroke={6} label={`Attendance ${fmtPct(a?.pct)}`}>
                <span className="text-[10px] font-black">{a?.pct == null ? "—" : `${Math.round(a.pct)}%`}</span>
              </Ring>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Attendance</div>
                <div className="text-sm font-black">{a ? `${a.attended} / ${a.total}` : "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
              <Ring value={mk?.avg ?? null} color="#6366f1" size={54} stroke={6} label={`Average ${fmtPct(mk?.avg)}`}>
                <span className="text-[10px] font-black">{mk ? `${Math.round(mk.avg)}%` : "—"}</span>
              </Ring>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Average marks</div>
                <div className="text-sm font-black">{mk ? plural(mk.count, "result") : "—"}</div>
              </div>
            </div>
          </div>

          <FlagChips row={row} target={m.target} pass={m.pass} />

          <section aria-labelledby="drawer-att">
            <h3 id="drawer-att" className="mb-2 text-sm font-extrabold">Attendance this period</h3>
            {records.length ? (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["present", "late", "leave", "absent"] as const).filter((k) => counts[k]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ATT_COLORS[k] }} aria-hidden="true" />{ATT_LABELS[k]} {counts[k]}
                    </span>
                  ))}
                </div>
                <ul aria-label="Every marked class, oldest first" className="flex flex-wrap gap-1">
                  {records.map((r, i) => (
                    <li key={`${r.sessionId}-${i}`} title={`${shortDate(r.date)} · ${ATT_LABELS[r.status] ?? r.status}`}
                      aria-label={`${shortDate(r.date)}: ${ATT_LABELS[r.status] ?? r.status}`}
                      className="h-4 w-4 rounded" style={{ backgroundColor: ATT_COLORS[r.status] ?? "#94a3b8" }} />
                  ))}
                </ul>
                {a && a.needed > 0 && a.total >= 3 && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    Needs {plural(a.needed, "class", "classes")} in a row to reach {m.target}%.
                  </p>
                )}
              </>
            ) : <p className="text-sm text-slate-500">{row.guest ? "Guests (open link) have no attendance." : "No marked classes in this period."}</p>}
          </section>

          <section aria-labelledby="drawer-marks">
            <h3 id="drawer-marks" className="mb-2 text-sm font-extrabold">Results this period</h3>
            {results.length ? (
              <ul className="space-y-2.5">
                {results.map((r, i) => (
                  <li key={`${r.assessmentId}-${i}`}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-bold text-slate-800 dark:text-slate-100">{r.title}</span>
                      <span className="shrink-0 font-black">{r.pct}%</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-2 rounded-full" style={{ width: `${Math.max(2, r.pct)}%`, backgroundColor: scoreColor(r.pct, m.pass) }} />
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-right text-[10px] font-semibold text-slate-500">
                        {r.kind === "copies" ? "Copy check" : "Assignment"} · {shortDate(r.date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No marks in this period.</p>}
          </section>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
            {parent?.parentPhone ? (
              <button type="button" onClick={() => openWhatsApp(message(), parent.parentPhone)} className={btnDark}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp parent
              </button>
            ) : row.studentId && !row.guest ? (
              <span className="self-center text-xs text-slate-500">No parent phone saved for this student.</span>
            ) : null}
            {row.studentId && !row.guest && (
              <button type="button" onClick={() => navigate(`/institute/students/${row.studentId}`)} className={btnGhost}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Full profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
