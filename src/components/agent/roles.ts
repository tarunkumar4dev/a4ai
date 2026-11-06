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
