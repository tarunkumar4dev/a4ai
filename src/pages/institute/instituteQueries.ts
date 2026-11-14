// src/pages/institute/instituteQueries.ts
// Data for /institute (admin dashboard), one TanStack Query per resource. Every key starts with
// ["institute", instituteId] so data never leaks between institutes, and a mutation refreshes only the
// resources it changes (INVALIDATES) instead of reloading the whole page. RLS decides what each query returns.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type InstituteResource =
  | "meta" | "teachers" | "batches" | "students" | "studentCounts"
  | "departments" | "sections" | "subjects" | "teaching" | "proctors" | "branding";

export const instKey = (instituteId: string, resource: InstituteResource) =>
  ["institute", instituteId, resource] as const;
export const resolveKey = (userId: string) => ["institute-resolve", userId] as const;

const EVERYTHING: readonly InstituteResource[] = [
  "meta", "teachers", "batches", "students", "studentCounts", "departments", "sections", "subjects", "teaching",
  "proctors",
];

/** What each dashboard mutation changes in the DB (incl. FK side effects), so only that is fetched again. */
export const INVALIDATES = {
  addBatch: ["batches", "subjects"],        // may also insert the batch's subject
  deleteBatch: ["batches"],                 // soft delete (is_active=false); students keep batch_id
  addStudent: ["students", "studentCounts"],
  removeStudent: ["students", "studentCounts"],
  bulkUpload: ["students", "studentCounts"], // also creates access codes (embedded in the students query)
  removeTeacher: ["teachers", "proctors"],  // a removed member's proctor_assignments go with them
  teacherRole: ["teachers"],                // promote / demote HOD, change department
  teaching: ["teaching"],                   // assign / remove subject or batch
  proctor: ["proctors", "batches"],         // assign_proctor also mirrors batches.proctor_id
  addDept: ["departments"],
  regenDeptCode: ["departments"],
  deleteDept: EVERYTHING,                   // sections cascade; teachers/batches/students lose the department
  addSection: ["sections"],
  deleteSection: ["sections", "batches", "students", "studentCounts", "teachers", "proctors"], // members lose the section
  joinCode: ["meta"],
} as const satisfies Record<string, readonly InstituteResource[]>;

export type InstituteMutation = keyof typeof INVALIDATES;

export function invalidateInstitute(qc: QueryClient, instituteId: string, mutation: InstituteMutation) {
  return Promise.all(
    INVALIDATES[mutation].map(r => qc.invalidateQueries({ queryKey: instKey(instituteId, r) })),
  );
}

/* ─────────────── fetchers (throw on error, so the query shows it) ─────────────── */

export interface ResolvedInstitute { id: string | null; isHod: boolean; hodDeptId: string | null }

/** Same lookup as before: an institute the user owns, else the first institute_members row. */
export async function resolveInstitute(userId: string): Promise<ResolvedInstitute> {
  const { data: ownerData, error: ownerErr } = await supabase
    .from("institutes")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!ownerErr && ownerData && ownerData.length > 0) return { id: ownerData[0].id, isHod: false, hodDeptId: null };

  const { data: mData, error: memberError } = await supabase
    .from("institute_members")
    .select("institute_id, role, department_id")
    .eq("user_id", userId)
    .limit(1);
  if (memberError) throw memberError;
  const m = mData?.[0];
  if (!m) return { id: null, isHod: false, hodDeptId: null };
  const isHod = m.role === "hod" && !!m.department_id;
  return { id: m.institute_id, isHod, hodDeptId: isHod ? m.department_id : null };
}

export async function fetchMeta(id: string) {
  const { data, error } = await supabase.from("institutes").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchTeachers(id: string) {
  const { data, error } = await supabase.from("institute_members").select("*")
    .eq("institute_id", id).eq("status", "active").in("role", ["teacher", "hod"])
    .order("joined_at", { ascending: false });
  if (error) throw error;
  let list = data || [];
  if (list.some((t: any) => !t.user_name || !t.user_email)) {
    // Fill missing names/emails from auth.users (same RPC the HOD page uses)
    const { data: dir, error: dirErr } = await supabase.rpc("get_member_directory", { p_institute_id: id });
    if (dirErr) console.warn("get_member_directory:", dirErr.message);
    const byId = Object.fromEntries((dir || []).map((r: any) => [r.user_id, r]));
    list = list.map((t: any) => byId[t.user_id]
      ? { ...t, user_name: t.user_name || byId[t.user_id].full_name, user_email: t.user_email || byId[t.user_id].email }
      : t);
  }
  return list;
}

export async function fetchBatches(id: string) {
  const { data, error } = await supabase.from("batches").select("*")
    .eq("institute_id", id).eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** PostgREST returns at most max_rows (1000 on Supabase) per request → read page by page until the count is reached. */
export const STUDENT_PAGE = 1000;
export async function fetchStudents(id: string) {
  const rows: any[] = [];
  let total = Infinity;
  while (rows.length < total) {
    // students has TWO FKs to batches since 05 (batch_id, lab_batch_id) → the embed must name the FK column,
    // else PostgREST rejects it as ambiguous (PGRST201) and no students load.
    const { data, error, count } = await supabase.from("students")
      .select("*, batches!batch_id(name), student_access_codes(access_code)", rows.length === 0 ? { count: "exact" } : undefined)
      .eq("institute_id", id).eq("is_active", true)
      .order("name", { ascending: true }).order("id", { ascending: true }) // id: stable order across pages
      .range(rows.length, rows.length + STUDENT_PAGE - 1);
    if (error) throw error;
    if (rows.length === 0) total = count ?? 0;
    if (!data || data.length === 0) break;
    rows.push(...data);
  }
  return rows.map((s: any) => ({ ...s, batch_name: s.batches?.name || "Unassigned" }));
}

/** Server-side counts (RLS applies), independent of how many rows a list request returns. */
export async function fetchStudentCounts(id: string) {
  const base = () => supabase.from("students").select("id", { count: "exact", head: true })
    .eq("institute_id", id).eq("is_active", true);
  const [all, unassigned] = await Promise.all([base(), base().is("batch_id", null)]);
  if (all.error) throw all.error;
  if (unassigned.error) throw unassigned.error;
  return { total: all.count ?? 0, unassigned: unassigned.count ?? 0 };
}

export async function fetchDepartments(id: string) {
  const { data, error } = await supabase.from("departments").select("*").eq("institute_id", id).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchSections(id: string) {
  const { data, error } = await supabase.from("sections").select("*, departments!inner(institute_id)")
    .eq("departments.institute_id", id).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchSubjects(id: string) {
  const { data, error } = await supabase.from("subjects").select("id, name, code, department_id")
    .eq("institute_id", id).order("code");
  if (error) throw error;
  return data || [];
}

export async function fetchTeaching(id: string) {
  const { data, error } = await supabase.from("teaching_assignments").select("teacher_id, batch_id, subject_id")
    .eq("institute_id", id).eq("is_active", true);
  if (error) throw error;
  return data || [];
}

/**
 * Class teachers (proctors), one per section — UNIQUE(section_id).
 * NOTE: proctor_assignments.teacher_id is an **institute_members.id**, not an auth user_id
 * (see CLAUDE.md "ID conventions"). Callers must map through the member row.
 */
export async function fetchProctors(id: string) {
  const { data, error } = await supabase.from("proctor_assignments")
    .select("id, section_id, teacher_id, department_id, is_active")
    .eq("institute_id", id);
  if (error) throw error;
  return (data || []).filter((p: any) => p.is_active !== false);
}

/** Logo/banner exist only if uploaded; checked with HEAD, off the critical path (the page doesn't wait for it). */
export async function fetchBranding(id: string) {
  const probe = async (name: "logo" | "banner") => {
    const { data } = supabase.storage.from("institute-assets").getPublicUrl(`${id}/${name}`);
    try {
      const res = await fetch(data.publicUrl, { method: "HEAD" });
      return res.ok && res.headers.get("content-type")?.startsWith("image") ? `${data.publicUrl}?t=${Date.now()}` : null;
    } catch { return null; }
  };
  const [logoUrl, bannerUrl] = await Promise.all([probe("logo"), probe("banner")]);
  return { logoUrl, bannerUrl };
}
