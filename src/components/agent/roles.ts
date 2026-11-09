// Who sees the agent and what it suggests. Staff only (primary_role admin/hod/proctor/teacher); students never.
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BarChart3, CalendarCheck, ClipboardList, FileText, GraduationCap, UserSearch, Users } from "lucide-react";

export type StaffRole = "admin" | "hod" | "proctor" | "teacher";
const STAFF: ReadonlySet<string> = new Set(["admin", "hod", "proctor", "teacher"]);

export const isStaffRole = (role: string | null | undefined): role is StaffRole => !!role && STAFF.has(role);

/** Badge text. The agent backend's own role (meta.role) wins over the app's primary_role. */
export function roleLabel(metaRole: string | null | undefined, primaryRole: string | null | undefined): string {
  const r = metaRole ?? primaryRole ?? "";
  if (r === "admin") return "Admin";
  if (r === "hod") return "HOD";
  if (r === "proctor") return "Proctor";
  return "Teacher";
}

export interface Suggestion { Icon: LucideIcon; title: string; hint: string; prompt: string }

export const SUGGESTIONS: Record<"admin" | "hod" | "teacher", Suggestion[]> = {
  admin: [
    { Icon: CalendarCheck, title: "Aaj ki attendance", hint: "Poore institute ka aaj ka haal", prompt: "Aaj ki attendance" },
    { Icon: AlertTriangle, title: "Low attendance (<75%)", hint: "Kin students ko dhyan chahiye", prompt: "Low attendance students (<75%)" },
    { Icon: UserSearch, title: "Sharma ma'am ki attendance", hint: "Kisi teacher ki classes ka record", prompt: "Sharma ma'am ki attendance" },
    { Icon: FileText, title: "Tests banaye is mahine", hint: "Kis teacher ne kitne test banaye", prompt: "Is mahine kitne tests banaye gaye?" },
  ],
  hod: [
    { Icon: CalendarCheck, title: "Department ki attendance", hint: "Aaj sab sections ka haal", prompt: "Aaj ki attendance" },
    { Icon: AlertTriangle, title: "Low attendance (<75%)", hint: "Department ke students jinhe dhyan chahiye", prompt: "Low attendance students (<75%)" },
    { Icon: BarChart3, title: "Attendance trend", hint: "Pichhle hafton ka graph", prompt: "Pichhle 4 hafte ka attendance trend" },
    { Icon: FileText, title: "Tests banaye is mahine", hint: "Teachers ke banaye tests", prompt: "Is mahine kitne tests banaye gaye?" },
  ],
  teacher: [
    { Icon: Users, title: "Meri class ki attendance", hint: "Is mahine ka percentage", prompt: "Meri class ki attendance" },
    { Icon: GraduationCap, title: "Class 10 trigonometry test banao", hint: "CBSE pattern, verified answers", prompt: "Class 10 trigonometry test banao, 40 marks" },
    { Icon: AlertTriangle, title: "Low attendance students", hint: "75% se kam wale students", prompt: "Low attendance students (<75%)" },
    { Icon: ClipboardList, title: "Marks summary", hint: "Assignments aur copies ke marks", prompt: "Meri class ka marks summary" },
  ],
};

export function suggestionsFor(metaRole: string | null | undefined, primaryRole: string | null | undefined): Suggestion[] {
  const r = metaRole ?? primaryRole;
  if (r === "admin") return SUGGESTIONS.admin;
  if (r === "hod") return SUGGESTIONS.hod;
  return SUGGESTIONS.teacher;
}

// ---- empty state from the caller's scope (v2: GET /agent/meta → scope) ------------------------------------
export interface ScopeLike { batches: { name: string; students: number | null; via?: string | null; kind?: string | null }[]; total_students: number | null }

/** "2 batches · 44 students" (null when the scope isn't known). Pure. */
export function scopeSummary(scope: ScopeLike | null | undefined): string | null {
  if (!scope || !scope.batches.length) return null;
  const n = scope.batches.length;
  const total = scope.total_students ?? (scope.batches.every((b) => typeof b.students === "number") ? scope.batches.reduce((a, b) => a + (b.students ?? 0), 0) : null);
  const parts = [`${n} batch${n === 1 ? "" : "es"}`];
  if (total !== null) parts.push(`${total} student${total === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

const VIA: Record<string, string> = { teacher: "Aap padhate hain", proctor: "Aap proctor hain", hod: "Aapka department", admin: "Institute" };

/**
 * Four empty-state cards: up to two about the caller's own batches (largest first), then role templates.
 * Never repeats a prompt. Pure.
 */
export function emptyCards(scope: ScopeLike | null | undefined, metaRole: string | null | undefined, primaryRole: string | null | undefined): Suggestion[] {
  const out: Suggestion[] = [];
  const batches = [...(scope?.batches ?? [])].filter((b) => b.kind !== "Lab").sort((a, b) => (b.students ?? -1) - (a.students ?? -1));
  for (const b of batches.slice(0, 2)) {
    const n = b.students;
    out.push({
      Icon: Users,
      title: `${b.name} ki attendance`,
      hint: [n === null ? null : `${n} students`, b.via ? VIA[b.via] ?? null : null].filter(Boolean).join(" · ") || "Is mahine ka haal",
      prompt: `${b.name} ki attendance`,
    });
  }
  if (batches.length > 1 && out.length < 4) {
    out.push({ Icon: BarChart3, title: "Mere sections compare karo", hint: `${batches.length} sections ki ranking`, prompt: "Sections ki attendance compare karo" });
  }
  for (const s of suggestionsFor(metaRole, primaryRole)) {
    if (out.length >= 4) break;
    if (out.some((o) => o.prompt.toLowerCase() === s.prompt.toLowerCase() || o.title.toLowerCase() === s.title.toLowerCase())) continue;
    out.push(s);
  }
  return out.slice(0, 4);
}
