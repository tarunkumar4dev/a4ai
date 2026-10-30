// src/components/attendance/NotifyParentsModal.tsx
// After attendance is saved: one WhatsApp button per parent. The button opens a wa.me link in a single
// reused window — the teacher's own WhatsApp sends the message, so there is no delivery receipt here.
// "Sent ✓" is UI state only: nothing is logged, and it resets when the sheet is saved again.
//
// Rows are listed only for students who have a usable parent number. The rest are named in
// "Missing Numbers" so the teacher knows who was skipped rather than silently losing them.

import React, { useMemo, useState } from "react";
import {
  buildAttendanceMessage, indianMobile10, maskParentPhone, waLink, WA_WINDOW, type NotifyStatus,
} from "@/lib/parentNotify";

export interface NotifyAttendanceRecord {
  student_id: string;
  student_name: string;
  status: NotifyStatus;
  guardian_phone: string | null;
  guardian_name: string | null;
}

export interface NotifySessionInfo {
  institute_name: string;
  section_name: string;
  subject_name: string | null;
  teacher_name: string;
  date: Date;
}

type Filter = "absent" | "absent_leave" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "absent", label: "Only Absent" },
  { key: "absent_leave", label: "Absent + Leave" },
  { key: "all", label: "All" },
];

const STATUS_BADGE: Record<NotifyStatus, { text: string; cls: string }> = {
  absent: { text: "ABSENT", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  leave: { text: "LEAVE", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  present: { text: "PRESENT", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

const matches = (f: Filter, st: NotifyStatus) =>
  f === "all" ? true : f === "absent_leave" ? st === "absent" || st === "leave" : st === "absent";

/** The preview sits on one line in a narrow cell, so the message's blank lines would read as gaps. */
const preview = (msg: string) => {
  const flat = msg.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}...` : flat;
};

export default function NotifyParentsModal({ attendanceRecords, sessionInfo, onClose }: {
  attendanceRecords: NotifyAttendanceRecord[];
  sessionInfo: NotifySessionInfo;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("absent");
  const [sent, setSent] = useState<Set<string>>(new Set());

  const messageFor = (r: NotifyAttendanceRecord) => buildAttendanceMessage({
    guardianName: r.guardian_name,
    instituteName: sessionInfo.institute_name,
    studentName: r.student_name,
    sectionName: sessionInfo.section_name,
    subjectName: sessionInfo.subject_name,
    teacherName: sessionInfo.teacher_name,
    status: r.status,
    date: sessionInfo.date,
  });

  const shown = useMemo(
    () => attendanceRecords.filter(r => matches(filter, r.status)),
    [attendanceRecords, filter],
  );
  const withNumber = useMemo(() => shown.filter(r => indianMobile10(r.guardian_phone)), [shown]);
  const missing = useMemo(() => shown.filter(r => !indianMobile10(r.guardian_phone)), [shown]);

  const send = (r: NotifyAttendanceRecord) => {
    const link = waLink(r.guardian_phone, messageFor(r));
    if (!link) return;
    window.open(link, WA_WINDOW);
    setSent(p => new Set(p).add(r.student_id));
  };

  const waBtn = (r: NotifyAttendanceRecord) => {
    const done = sent.has(r.student_id);
    return (
      <button type="button" onClick={() => send(r)} disabled={done}
        className={`inline-flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold touch-manipulation sm:w-auto ${
          done
            ? "cursor-default bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "bg-[#25D366] text-white hover:bg-[#1eb558] active:scale-95"
        }`}>
        {done ? "Sent ✓" : "WhatsApp →"}
      </button>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Notify Parents via WhatsApp"
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl dark:bg-slate-900">

        {/* Header + filters */}
        <div className="border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5 dark:border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">Notify Parents via WhatsApp</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Each button opens WhatsApp with the message ready — press Send there.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
              className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 touch-manipulation hover:text-slate-700 dark:hover:text-slate-200">×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-semibold touch-manipulation ${
                  filter === f.key
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}>
                {f.label}{filter === f.key ? " ✓" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-3 sm:px-5">
          {withNumber.length === 0 && missing.length === 0 && (
            <p className="py-8 text-center text-sm font-medium text-slate-400">No students in this list.</p>
          )}

          {/* Desktop: table. Mobile: the same rows as cards, since five columns do not fit a phone. */}
          {withNumber.length > 0 && (
            <>
              <table className="hidden w-full text-left sm:table">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/5">
                    <th className="py-2 pr-3 font-bold">Student Name</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 pr-3 font-bold">Number</th>
                    <th className="py-2 pr-3 font-bold">Message Preview</th>
                    <th className="py-2 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {withNumber.map(r => (
                    <tr key={r.student_id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="py-2.5 pr-3 text-sm font-semibold text-slate-800 dark:text-white">{r.student_name}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status].cls}`}>
                          {STATUS_BADGE[r.status].text}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">{maskParentPhone(r.guardian_phone)}</td>
                      <td className="max-w-[18rem] py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400">{preview(messageFor(r))}</td>
                      <td className="py-2.5">{waBtn(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2 sm:hidden">
                {withNumber.map(r => (
                  <div key={r.student_id} className="rounded-2xl border border-slate-200/70 p-3 dark:border-white/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{r.student_name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className={`rounded-md px-1.5 py-0.5 font-bold ${STATUS_BADGE[r.status].cls}`}>
                          {STATUS_BADGE[r.status].text}
                        </span>
                        <span className="tabular-nums">{maskParentPhone(r.guardian_phone)}</span>
                      </p>
                    </div>
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-snug text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      {preview(messageFor(r))}
                    </p>
                    <div className="mt-2">{waBtn(r)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Missing Numbers */}
          {missing.length > 0 && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Missing Numbers ({missing.length})
              </p>
              <ul className="space-y-1 opacity-70">
                {missing.map(r => (
                  <li key={r.student_id} className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">{r.student_name}</span>
                    <span className="shrink-0">{STATUS_BADGE[r.status].text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">
                Add numbers in student profile to notify these parents
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-white/5">
          <button type="button" onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 touch-manipulation hover:bg-slate-50 sm:w-auto dark:border-white/10 dark:text-white dark:hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
