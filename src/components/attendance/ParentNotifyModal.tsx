// src/components/attendance/ParentNotifyModal.tsx
// After attendance is saved: one WhatsApp button per parent (wa.me link, the teacher's own WhatsApp
// sends it). Default = absent only; "Leave wale bhi" adds leave, "Sab" adds everyone.
// "Bheja ✓" is UI state only — nothing is logged yet.

import React, { useMemo, useState } from "react";
import { indianMobile10, waLink, type NotifyStatus } from "@/lib/parentNotify";

export interface NotifyStudent {
  id: string;
  name: string;
  rollNo?: string;
  status: NotifyStatus;
  parentPhone?: string | null;
}

const STATUS_LABEL: Record<NotifyStatus, { text: string; cls: string }> = {
  absent: { text: "Absent", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  leave: { text: "Leave", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  present: { text: "Present", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

// One named window: every click reuses the same WhatsApp tab instead of opening a new one.
const WA_WINDOW = "a4ai_wa";

export default function ParentNotifyModal({ open, onClose, students, messageFor }: {
  open: boolean;
  onClose: () => void;
  students: NotifyStudent[];
  messageFor: (s: NotifyStudent) => string;
}) {
  const [withLeave, setWithLeave] = useState(false);
  const [all, setAll] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const shown = useMemo(
    () => students.filter(s => all || s.status === "absent" || (withLeave && s.status === "leave")),
    [students, all, withLeave],
  );
  const withNumber = shown.filter(s => indianMobile10(s.parentPhone));
  const noNumber = shown.filter(s => !indianMobile10(s.parentPhone));

  if (!open) return null;

  const send = (s: NotifyStudent) => {
    const link = waLink(s.parentPhone, messageFor(s));
    if (!link) return;
    window.open(link, WA_WINDOW);
    setSent(p => ({ ...p, [s.id]: true }));
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg max-h-[90vh] flex flex-col sm:rounded-2xl rounded-t-3xl shadow-2xl">
        {/* header */}
        <div className="p-5 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Parents ko batayein</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                WhatsApp button aapke WhatsApp mein message khol dega — wahan Send dabayein.
              </p>
            </div>
            <button onClick={onClose} className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700 text-lg leading-none touch-manipulation" aria-label="Close">×</button>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={withLeave || all} disabled={all} onChange={e => setWithLeave(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              Leave wale bhi
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              Sab
            </label>
          </div>
        </div>

        {/* rows */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-2">
          {shown.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400 font-medium">Is list mein koi student nahi hai.</p>
          )}
          {withNumber.map(s => {
            const st = STATUS_LABEL[s.status];
            const d = indianMobile10(s.parentPhone)!;
            return (
              <div key={s.id} className="rounded-2xl border border-slate-200/70 dark:border-white/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-md font-bold ${st.cls}`}>{st.text}</span>
                      <span className="tabular-nums">Parent ••••{d.slice(-4)}</span>
                    </p>
                  </div>
                  <button onClick={() => send(s)}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold text-white active:scale-95 touch-manipulation ${sent[s.id] ? "bg-slate-400" : "bg-[#25D366]"}`}>
                    {sent[s.id] ? "Bheja ✓" : "WhatsApp"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2 whitespace-pre-wrap break-words">
                  {messageFor(s)}
                </p>
              </div>
            );
          })}

          {noNumber.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Number nahi hai ({noNumber.length})</p>
              <div className="space-y-1 opacity-60">
                {noNumber.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-500">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 ml-2">{STATUS_LABEL[s.status].text} · Number nahi hai</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Number student ki profile mein "Parent WhatsApp number" se daalein.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
