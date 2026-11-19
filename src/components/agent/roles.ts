// Who sees the agent and which role it speaks to (no strings here: it is in the initial bundle via voice navigation;
// the starter cards / scope line live in ./starters). Staff only (primary_role admin / hod /
// proctor / teacher); students never. A teacher can be several things at once (HOD + subject teacher, proctor +
// subject teacher): the agent role is the WIDEST scope — admin > HOD > proctor > teacher.

export type StaffRole = "admin" | "hod" | "proctor" | "teacher";
const STAFF: ReadonlySet<string> = new Set(["admin", "hod", "proctor", "teacher"]);

export const isStaffRole = (role: string | null | undefined): role is StaffRole => !!role && STAFF.has(role);

/** The subset of get_my_access() this file needs. */
export interface AccessLike {
  primary_role?: string | null;
  hod_department_ids?: string[] | null;
  proctor_section_ids?: string[] | null;
}

/**
 * The role the agent should speak to. The backend's own role (meta.role: admin | hod | teacher — it has no
 * "proctor") wins for admin / HOD; a teacher with proctor sections is a proctor here. Pure.
 */
export function agentRole(metaRole: string | null | undefined, access: AccessLike | null | undefined): StaffRole {
  const p = access?.primary_role ?? null;
  if (metaRole === "admin" || p === "admin") return "admin";
  if (metaRole === "hod" || p === "hod" || (access?.hod_department_ids?.length ?? 0) > 0) return "hod";
  if (p === "proctor" || (access?.proctor_section_ids?.length ?? 0) > 0) return "proctor";
  return "teacher";
}
