// src/hooks/useMyScope.ts
// The ONE place teacher-side components get "my batches / my sections" from.
// Source: get_my_access() via useAccess() — never teacher_batches (legacy; it's why teachers saw everything).
//
//   admin   → every active batch of the institute
//   others  → batches I teach (teaching_assignments / timetable_slots)
//             + every batch (main + labs) of sections I'm proctor of
//   HOD     → same as a teacher here; their department view lives on /hod.
//             manageableBatches = their department's batches (only used for "Add student").
//
// RLS (02_rls_policies.sql) enforces the same thing server-side; this hook keeps the UI honest.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAccess } from "@/context/AccessProvider";

export interface ScopeBatch {
  id: string;
  name: string;
  class_level: string | null;
  section_id: string | null;
  department_id: string | null;
}

export interface MyScope {
  loading: boolean;
  instituteId: string | null;
  isAdmin: boolean;
  isHod: boolean;
  /** Batches I may see / post to (sorted by name). */
  batches: ScopeBatch[];
  batchIds: string[];
  /** Proctor sections + sections of the batches I teach. */
  sectionIds: string[];
  proctorSectionIds: string[];
  /** Only admin / HOD may add students (RLS stu_insert). */
  canManageStudents: boolean;
  /** Batches a new student may be added to: admin → all, HOD → own department(s), others → none. */
  manageableBatches: ScopeBatch[];
  refresh: () => void;
}

type Loaded = Pick<MyScope, "batches" | "manageableBatches">;

const BATCH_COLS = "id, name, class_level, section_id, department_id";
// One fetch per access snapshot, shared by every tab mounted on the page.
const cache = new Map<string, Promise<Loaded>>();

const inList = (ids: string[]) => `(${ids.join(",")})`;

async function loadScope(
  instituteId: string, isAdmin: boolean, teachingIds: string[], proctorSectionIds: string[], hodDeptIds: string[],
): Promise<Loaded> {
  if (isAdmin) {
    const { data, error } = await supabase.from("batches").select(BATCH_COLS)
      .eq("institute_id", instituteId).eq("is_active", true).order("name");
    if (error) throw error;
    return { batches: data || [], manageableBatches: data || [] };
  }

  const ors: string[] = [];
  if (teachingIds.length) ors.push(`id.in.${inList(teachingIds)}`);
  if (proctorSectionIds.length) ors.push(`section_id.in.${inList(proctorSectionIds)}`);

  const [mine, managed] = await Promise.all([
    ors.length
      ? supabase.from("batches").select(BATCH_COLS).eq("institute_id", instituteId).eq("is_active", true).or(ors.join(",")).order("name")
      : Promise.resolve({ data: [] as ScopeBatch[], error: null }),
    hodDeptIds.length
      ? supabase.from("batches").select(BATCH_COLS).eq("institute_id", instituteId).eq("is_active", true).in("department_id", hodDeptIds).order("name")
      : Promise.resolve({ data: [] as ScopeBatch[], error: null }),
  ]);
  if (mine.error) throw mine.error;
  if (managed.error) throw managed.error;
  return { batches: mine.data || [], manageableBatches: managed.data || [] };
}

export function useMyScope(): MyScope {
  const { access, loading: accessLoading } = useAccess();
  const instituteId = access?.institute_id || null;
  const isAdmin = access?.primary_role === "admin";
  const hodDeptIds = access?.hod_department_ids || [];
  const isHod = hodDeptIds.length > 0;
  const teachingIds = access?.teaching_batch_ids || [];
  const proctorSectionIds = access?.proctor_section_ids || []; // only used to build `key` / fetch

  const key = instituteId
    ? JSON.stringify([instituteId, isAdmin, [...teachingIds].sort(), [...proctorSectionIds].sort(), [...hodDeptIds].sort()])
    : "";

  const [state, setState] = useState<{ key: string; data: Loaded } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (accessLoading || !key || !instituteId) return;
    let cancelled = false;
    if (!cache.has(key)) cache.set(key, loadScope(instituteId, isAdmin, teachingIds, proctorSectionIds, hodDeptIds));
    cache.get(key)!
      .then(data => { if (!cancelled) setState({ key, data }); })
      .catch(err => {
        console.error("useMyScope:", err);
        cache.delete(key);
        if (!cancelled) setState({ key, data: { batches: [], manageableBatches: [] } });
      });
    return () => { cancelled = true; };
    // key captures all inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, key, tick]);

  const refresh = useCallback(() => { cache.delete(key); setTick(t => t + 1); }, [key]);

  const ready = !!state && state.key === key;
  const loading = accessLoading || (!!key && !ready);

  // Stable identities (only change when the scope changes) so callers can use them in effect deps.
  return useMemo(() => {
    const batches = ready ? state!.data.batches : [];
    const proctorIds = access?.proctor_section_ids || [];
    return {
      loading,
      instituteId,
      isAdmin,
      isHod,
      batches,
      batchIds: batches.map(b => b.id),
      sectionIds: [...new Set([...proctorIds, ...(batches.map(b => b.section_id).filter(Boolean) as string[])])],
      proctorSectionIds: proctorIds,
      canManageStudents: isAdmin || isHod,
      manageableBatches: ready ? state!.data.manageableBatches : [],
      refresh,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state, loading, instituteId, isAdmin, isHod, refresh, access]);
}
