// Who sees the agent, which role it speaks to, and what it suggests. Staff only (primary_role admin / hod /
// proctor / teacher); students never. A teacher can be several things at once (HOD + subject teacher, proctor +
// subject teacher): the agent role is the WIDEST scope — admin > HOD > proctor > teacher.
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, BarChart3, CalendarCheck, ClipboardList, FileSpreadsheet, FileText, GraduationCap, ListChecks, Users,
} from "lucide-react";

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

/** Badge text. */
export function roleLabel(metaRole: string | null | undefined, primaryRole: string | null | undefined, access?: AccessLike | null): string {
  const r = agentRole(metaRole, { ...(access ?? {}), primary_role: access?.primary_role ?? primaryRole });
  return { admin: "Admin", hod: "HOD", proctor: "Proctor", teacher: "Teacher" }[r];
}

export interface Suggestion { Icon: LucideIcon; title: string; hint: string; prompt: string }

export const SUGGESTIONS: Record<StaffRole, Suggestion[]> = {
  admin: [
    { Icon: CalendarCheck, title: "Aaj poore institute ki attendance", hint: "Har department ka aaj ka haal", prompt: "Aaj poore institute ki attendance" },
    { Icon: BarChart3, title: "Department-wise comparison", hint: "Is mahine kaun aage, kaun peeche", prompt: "Department-wise comparison is mahine" },
    { Icon: FileSpreadsheet, title: "75% se kam wale, Excel mein", hint: "Poore institute ki list download", prompt: "75% se kam attendance wale students, Excel mein" },
    { Icon: FileText, title: "Tests banaye is mahine", hint: "Kis teacher ne kitne test banaye", prompt: "Is mahine teachers ne kitne tests banaye?" },
  ],
  hod: [
    { Icon: BarChart3, title: "Department ka section-wise comparison", hint: "Attendance ranking, is mahine", prompt: "Department ka section-wise comparison" },
    { Icon: CalendarCheck, title: "Department ki attendance", hint: "Aaj sab sections ka haal", prompt: "Is mahine department ki attendance" },
    { Icon: FileSpreadsheet, title: "75% se kam wale, Excel mein", hint: "Department ke students ki list", prompt: "Department me 75% se kam attendance wale students, Excel mein" },
    { Icon: FileText, title: "Teachers ke tests", hint: "Kisne kitne test banaye", prompt: "Is mahine teachers ne kitne tests banaye?" },
  ],
  proctor: [
    { Icon: FileSpreadsheet, title: "Mere section ke 75% se kam wale, Excel mein", hint: "Download karke parents ko bhejein", prompt: "Mere section ke 75% se kam wale, Excel mein" },
    { Icon: CalendarCheck, title: "Mere section ki attendance", hint: "Is hafte ka haal", prompt: "Mere section ki is hafte ki attendance" },
    { Icon: AlertTriangle, title: "Lagatar absent students", hint: "Pichhle 7 din me", prompt: "Mere section me pichhle 7 din se absent students" },
    { Icon: ListChecks, title: "Main kya kya dekh sakta hoon?", hint: "Mere sections aur subjects", prompt: "Main kya kya dekh sakta hoon?" },
  ],
  teacher: [
    { Icon: Users, title: "Meri classes ki attendance", hint: "Is mahine ka percentage", prompt: "Meri classes ki is mahine ki attendance" },
    { Icon: GraduationCap, title: "Class 10 trigonometry test banao", hint: "CBSE pattern, verified answers", prompt: "Class 10 trigonometry test banao, 40 marks" },
    { Icon: AlertTriangle, title: "75% se kam wale students", hint: "Meri classes me", prompt: "Meri classes me 75% se kam attendance wale students" },
    { Icon: ClipboardList, title: "Marks summary", hint: "Mere tests ke marks", prompt: "Mere tests ke marks summary" },
  ],
};

export function suggestionsFor(role: StaffRole): Suggestion[] {
  return SUGGESTIONS[role];
}

/** "3 batches" / "Poora institute" — what the empty state says the caller can see. Pure. */
export function scopeLine(role: StaffRole, batchCount: number | null): string | null {
  if (role === "admin") return "Poora institute";
  if (batchCount === null) return null;
  if (batchCount === 0) return "Abhi koi batch assign nahi hai";
  return `${batchCount} batch${batchCount === 1 ? "" : "es"}`;
}

/**
 * Four empty-state cards. Teachers: up to two of their own batches first ("<name> ki is mahine ki attendance" — the
 * backend's own entity phrasing), then role starters. Other roles: their role starters. Never repeats. Pure.
 */
export function emptyCards(role: StaffRole, batches: { name: string }[] = []): Suggestion[] {
  const out: Suggestion[] = [];
  if (role === "teacher") {
    for (const b of batches.slice(0, 2)) {
      out.push({ Icon: Users, title: `${b.name} ki attendance`, hint: "Is mahine", prompt: `${b.name} ki is mahine ki attendance` });
    }
  }
  for (const s of SUGGESTIONS[role]) {
    if (out.length >= 4) break;
    if (out.some((o) => o.prompt.toLowerCase() === s.prompt.toLowerCase())) continue;
    if (role === "teacher" && batches.length && s.title === "Meri classes ki attendance") continue;
    out.push(s);
  }
  return out.slice(0, 4);
}
