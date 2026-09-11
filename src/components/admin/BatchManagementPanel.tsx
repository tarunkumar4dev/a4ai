// src/components/admin/BatchManagementPanel.tsx
// ──────────────────────────────────────────────────────────────────────
// Admin panel to assign proctors + subject teachers to batches.
// Shows in institute admin dashboard under "Settings" or "Attendance Setup".
//
// Usage:
//   import BatchManagementPanel from "@/components/admin/BatchManagementPanel";
//   {activeTab === "batch-settings" && <BatchManagementPanel instituteId={instituteId} />}
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ───── TYPES ───── */
interface Batch {
  id: string;
  name: string;
  proctor_id: string | null;
  departmentName?: string;
  studentCount?: number;
}

interface Member {
  user_id: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  displayName: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Assignment {
  id?: string;
  teacher_id: string;
  subject_id: string;
  teacherName: string;
  subjectName: string;
  subjectCode: string;
}

/* ───── HELPERS ───── */
// Priority chain for showing a friendly name instead of raw UUID
function displayNameOf(m?: {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  user_id?: string | null;
  id?: string | null;
}): string {
  if (!m) return "—";
  const uid = m.user_id || m.id || "";
  return (
    (m.full_name && m.full_name.trim()) ||
    (m.username && m.username.trim()) ||
    (m.email && m.email.includes("@") ? m.email.split("@")[0] : m.email) ||
    (uid ? `Teacher ${uid.substring(0, 6)}` : "Unknown")
  );
}

/* ───── ICONS ───── */
const I = {
  Shield: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Book: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Spinner: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  ChevDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
};

/* ───── TOAST ───── */
type Toast = { id: number; msg: string; ok: boolean };
let _tid = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, ok = true) => {
    const id = ++_tid;
    setToasts(p => [...p.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, add };
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function BatchManagementPanel({ instituteId }: { instituteId: string }) {
  const { toasts, add } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingProctor, setSavingProctor] = useState<string | null>(null);
  const [addingAssign, setAddingAssign] = useState<string | null>(null);

  // For the add assignment form (per batch)
  const [newTeacher, setNewTeacher] = useState<Record<string, string>>({});
  const [newSubject, setNewSubject] = useState<Record<string, string>>({});

  // ── Load all data ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Batches
      const { data: bData } = await supabase
        .from("batches")
        .select("id, name, proctor_id, departments(name)")
        .eq("institute_id", instituteId)
        .neq("is_active", false)
        .order("name");

      // Student counts
      const bIds = (bData || []).map((b: any) => b.id);
      const { data: stuCounts } = await supabase
        .from("students").select("batch_id")
        .in("batch_id", bIds).eq("is_active", true);
      const cMap: Record<string, number> = {};
      stuCounts?.forEach((s: any) => { cMap[s.batch_id] = (cMap[s.batch_id] || 0) + 1; });

      setBatches((bData || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        proctor_id: b.proctor_id || null,
        departmentName: (b.departments as any)?.name,
        studentCount: cMap[b.id] || 0,
      })));

      // Institute members (teachers/staff)
      const { data: mData } = await supabase
        .from("institute_members")
        .select("user_id, role")
        .eq("institute_id", instituteId)
        .eq("status", "active");

      // Try RPC to fetch full_name / email from auth.users
      let userInfoData: any[] | null = null;
      try {
        const rpcRes = await supabase.rpc("get_institute_members_info", {
          p_institute_id: instituteId,
        });
        userInfoData = rpcRes.data || null;
      } catch {
        userInfoData = null;
      }

      if (userInfoData && userInfoData.length > 0) {
        // ✅ FIX: Build Member objects with proper display names
        setMembers(
          userInfoData.map((u: any) => {
            const member: Member = {
              user_id: u.user_id,
              full_name: u.full_name || u.name || null,
              username: u.username || null,
              email: u.email || null,
              displayName: "",
            };
            member.displayName = displayNameOf(member);
            return member;
          })
        );
      } else {
        // Fallback: just user_ids with shortened display
        setMembers(
          (mData || []).map((m: any) => {
            const member: Member = {
              user_id: m.user_id,
              full_name: null,
              username: null,
              email: null,
              displayName: "",
            };
            member.displayName = displayNameOf(member);
            return member;
          })
        );
      }

      // Subjects
      const { data: sData } = await supabase
        .from("subjects")
        .select("id, name, code")
        .eq("institute_id", instituteId)
        .eq("is_active", true)
        .order("code");
      setSubjects(sData || []);

      // Teaching assignments per batch
      const { data: taData } = await supabase
        .from("teaching_assignments")
        .select("id, teacher_id, batch_id, subject_id, subjects(name, code)")
        .eq("institute_id", instituteId)
        .eq("is_active", true);

      // Build a quick lookup of member display names
      const nameByUid: Record<string, string> = {};
      (userInfoData || []).forEach((u: any) => {
        nameByUid[u.user_id] = displayNameOf({
          full_name: u.full_name || u.name,
          username: u.username,
          email: u.email,
          user_id: u.user_id,
        });
      });
      (mData || []).forEach((m: any) => {
        if (!nameByUid[m.user_id]) {
          nameByUid[m.user_id] = displayNameOf({ user_id: m.user_id });
        }
      });

      const aMap: Record<string, Assignment[]> = {};
      for (const ta of (taData || [])) {
        if (!aMap[ta.batch_id]) aMap[ta.batch_id] = [];
        aMap[ta.batch_id].push({
          id: ta.id,
          teacher_id: ta.teacher_id,
          subject_id: ta.subject_id,
          teacherName:
            nameByUid[ta.teacher_id] ||
            displayNameOf({ user_id: ta.teacher_id }),
          subjectName: (ta.subjects as any)?.name || "",
          subjectCode: (ta.subjects as any)?.code || "",
        });
      }
      setAssignments(aMap);

    } catch (e: any) {
      add("Load failed: " + e.message, false);
    }
    setLoading(false);
  }, [instituteId, add]);

  useEffect(() => { load(); }, [load]);

  // ── Set proctor ──
  const setProctor = useCallback(async (batchId: string, proctorId: string) => {
    setSavingProctor(batchId);
    const { error } = await supabase
      .from("batches")
      .update({ proctor_id: proctorId || null })
      .eq("id", batchId);
    if (error) { add("Failed: " + error.message, false); }
    else {
      setBatches(p => p.map(b => b.id === batchId ? { ...b, proctor_id: proctorId || null } : b));
      add("Proctor updated");
    }
    setSavingProctor(null);
  }, [add]);

  // ── Add teaching assignment ──
  const addAssignment = useCallback(async (batchId: string) => {
    const tid = newTeacher[batchId];
    const sid = newSubject[batchId];
    if (!tid || !sid) { add("Select both teacher and subject", false); return; }
    setAddingAssign(batchId);
    const { error } = await supabase.from("teaching_assignments").insert({
      institute_id: instituteId,
      teacher_id: tid,
      batch_id: batchId,
      subject_id: sid,
      is_active: true,
    });
    if (error) { add(error.message.includes("unique") ? "Already assigned" : error.message, false); }
    else {
      add("Teacher assigned to subject");
      setNewTeacher(p => ({ ...p, [batchId]: "" }));
      setNewSubject(p => ({ ...p, [batchId]: "" }));
      load();
    }
    setAddingAssign(null);
  }, [newTeacher, newSubject, instituteId, add, load]);

  // ── Remove teaching assignment ──
  const removeAssignment = useCallback(async (assignId: string, batchId: string) => {
    const { error } = await supabase
      .from("teaching_assignments")
      .update({ is_active: false })
      .eq("id", assignId);
    if (error) { add("Remove failed", false); }
    else {
      setAssignments(p => ({
        ...p,
        [batchId]: (p[batchId] || []).filter(a => a.id !== assignId),
      }));
      add("Assignment removed");
    }
  }, [add]);

  // ✅ FIX: memberOptions now use the proper displayName field
  const memberOptions = useMemo(
    () =>
      members.map(m => ({
        value: m.user_id,
        label: m.displayName || m.email || `Teacher ${m.user_id.slice(0, 6)}`,
      })),
    [members]
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
      <I.Spinner /> Loading batch settings…
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Toast */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.ok ? "#1E293B" : "#7F1D1D", color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
            {t.ok ? "✓" : "⚠"} {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Batch &amp; Teacher Setup</h2>
        <p className="text-sm text-slate-500 mt-1">Assign proctors to sections and subject teachers to batches.</p>
      </div>

      {batches.length === 0 && (
        <div className="glass-panel rounded-[28px] p-8 text-center">
          <p className="text-slate-400 font-semibold">No batches found for this institute.</p>
        </div>
      )}

      {batches.map(batch => {
        const batchAssignments = assignments[batch.id] || [];
        const currentProctor = members.find(m => m.user_id === batch.proctor_id);

        return (
          <div key={batch.id} className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-7">
            {/* Batch header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{batch.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {batch.departmentName && `${batch.departmentName} · `}
                  {batch.studentCount} students
                </p>
              </div>
            </div>

            {/* Proctor assignment */}
            <div className="mb-5 p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-slate-500"><I.Shield /></span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Proctor (class teacher)</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={batch.proctor_id || ""}
                  onChange={(e) => setProctor(batch.id, e.target.value)}
                  className="flex-1 min-w-[200px] inset-pill border-none rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none"
                >
                  <option value="">— Not assigned —</option>
                  {memberOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {savingProctor === batch.id ? (
                  <span className="text-slate-400"><I.Spinner /></span>
                ) : currentProctor ? (
                  // ✅ FIX: use displayName instead of substring
                  <span className="text-[11px] font-bold text-emerald-600 inset-pill border-none px-3 py-1.5 rounded-full flex items-center gap-1">
                    <I.Check /> {currentProctor.displayName}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-600 inset-pill border-none px-3 py-1.5 rounded-full">Not set</span>
                )}
              </div>
            </div>

            {/* Teaching assignments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-slate-500"><I.Book /></span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Subject teachers</span>
                <span className="text-[11px] font-bold text-slate-400 ml-auto">{batchAssignments.length} assigned</span>
              </div>

              {/* Existing assignments */}
              {batchAssignments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {batchAssignments.map((a, i) => (
                    <div key={a.id || i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                      <div>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{a.teacherName}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="text-sm text-slate-500">{a.subjectName}</span>
                        <span className="ml-2 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{a.subjectCode}</span>
                      </div>
                      {a.id && (
                        <button onClick={() => removeAssignment(a.id!, batch.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <I.Trash />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add assignment row */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={newTeacher[batch.id] || ""}
                  onChange={(e) => setNewTeacher(p => ({ ...p, [batch.id]: e.target.value }))}
                  className="flex-1 min-w-[160px] inset-pill border-none rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none"
                >
                  <option value="">Teacher…</option>
                  {memberOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select
                  value={newSubject[batch.id] || ""}
                  onChange={(e) => setNewSubject(p => ({ ...p, [batch.id]: e.target.value }))}
                  className="flex-1 min-w-[160px] inset-pill border-none rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none"
                >
                  <option value="">Subject…</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                <button
                  onClick={() => addAssignment(batch.id)}
                  disabled={addingAssign === batch.id}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}
                >
                  {addingAssign === batch.id ? <I.Spinner /> : <I.Plus />}
                  Assign
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}