// src/components/checker/CopyChecker.tsx
// "Check Copies" tab of the Test Generator page: list of checks → new check → class list.
// One checker for everything (replaces the separate Test Checker and Assignment Checker pages).

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import NewCheckSession from "./NewCheckSession";
import CheckSessionView from "./CheckSessionView";

type Row = { id: string; title: string; total_marks: number | null; created_at: string; rubric_status: string; source: string };
type Counts = Record<string, { total: number; approved: number; review: number }>;

export default function CopyChecker({ initialTestId, onConsumeTestId }: {
  initialTestId?: string | null;
  onConsumeTestId?: () => void;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<{ name: "list" } | { name: "new"; testId?: string | null } | { name: "session"; id: string }>(
    initialTestId ? { name: "new", testId: initialTestId } : { name: "list" });
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialTestId) { setView({ name: "new", testId: initialTestId }); onConsumeTestId?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTestId]);

  useEffect(() => {
    if (!user || view.name !== "list") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("check_sessions")
        .select("id, title, total_marks, created_at, rubric_status, source")
        .order("created_at", { ascending: false }).limit(50);
      const list = (data || []) as Row[];
      const c: Counts = {};
      if (list.length) {
        const { data: sh } = await supabase.from("check_sheets").select("session_id, status").in("session_id", list.map(r => r.id));
        (sh || []).forEach(s => {
          c[s.session_id] = c[s.session_id] || { total: 0, approved: 0, review: 0 };
          c[s.session_id].total++;
          if (s.status === "approved") c[s.session_id].approved++;
          if (s.status === "checked") c[s.session_id].review++;
        });
      }
      if (!cancelled) { setRows(list); setCounts(c); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, view.name]);

  if (!user) {
    return <p className="text-center text-sm text-gray-500 py-16">Log in to check answer copies.</p>;
  }
  if (view.name === "new") {
    return <NewCheckSession initialTestId={view.testId} onCancel={() => setView({ name: "list" })}
      onCreated={id => setView({ name: "session", id })} />;
  }
  if (view.name === "session") {
    return <CheckSessionView sessionId={view.id} onBack={() => setView({ name: "list" })} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-3xl bg-[#111827] text-white p-5">
        <p className="text-lg font-black">Check answer copies with AI</p>
        <p className="text-sm text-gray-300 mt-1">
          Pick the paper once, photograph each student's copy, review and approve. Marks follow your marking scheme.
        </p>
        <button onClick={() => setView({ name: "new" })}
          className="mt-4 w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white text-[#111827] font-black text-sm active:scale-[0.99]">
          + New check
        </button>
      </div>

      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Your checks</p>
        {loading ? <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          : rows.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
              <p className="text-sm font-bold text-gray-700">No checks yet</p>
              <p className="text-xs text-gray-500 mt-1">Start with a test from your Test History, or a photo of any question paper.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rows.map(r => {
                const c = counts[r.id] || { total: 0, approved: 0, review: 0 };
                const pct = c.total ? Math.round(c.approved / c.total * 100) : 0;
                return (
                  <button key={r.id} onClick={() => setView({ name: "session", id: r.id })} className="w-full text-left px-4 py-3.5 active:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.title}</p>
                        <p className="text-xs text-gray-400">
                          {[r.total_marks && `${r.total_marks} marks`, `${c.total} students`, new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}
                          {c.review > 0 && <span className="text-orange-600 font-bold"> · {c.review} to review</span>}
                          {r.rubric_status === "failed" && <span className="text-red-600 font-bold"> · scheme failed</span>}
                        </p>
                      </div>
                      <span className="text-xs font-black text-gray-700">{c.approved}/{c.total}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
