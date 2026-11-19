// Starter cards, scope line and role name of the agent panel (in its language). Lazy: only the panel imports this,
// so the eager voice navigation (./roles) never pulls the dictionaries into the initial bundle.
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, BarChart3, CalendarCheck, ClipboardList, FileSpreadsheet, FileText, GraduationCap, ListChecks, Users,
} from "lucide-react";
import { translate, type AgentKey, type TFn } from "@/lib/agent/i18n";
import type { MetaResponse } from "@/lib/agent/types";
import { agentRole, type AccessLike, type StaffRole } from "./roles";

const hx: TFn = ((k: AgentKey, p?: Record<string, string | number>) => translate("hinglish", k, p)) as TFn;

/** Role name for the scope chip ("Teacher · 3 batch"). */
export function roleLabel(metaRole: string | null | undefined, primaryRole: string | null | undefined, access?: AccessLike | null, t: TFn = hx): string {
  const r = agentRole(metaRole, { ...(access ?? {}), primary_role: access?.primary_role ?? primaryRole });
  return t(`role.${r}` as AgentKey);
}

type Features = Partial<MetaResponse["features"]> | null | undefined;
type Need = "batch" | "paper_generation" | "defaulters_export";

export interface Suggestion {
  id: string; Icon: LucideIcon; title: string; hint: string; prompt: string;
  /** set → shown but not clickable, with this reason (e.g. no batch assigned yet) */ disabledReason?: string | null;
}
interface Starter { id: string; Icon: LucideIcon; base: string; needs: Need[] }

/** Starter cards per role. Every one maps to a real backend tool; `needs` = what must exist for it to work. */
export const STARTERS: Record<StaffRole, Starter[]> = {
  admin: [
    { id: "today", Icon: CalendarCheck, base: "starter.admin.today", needs: [] },
    { id: "compare", Icon: BarChart3, base: "starter.admin.compare", needs: [] },
    { id: "low", Icon: FileSpreadsheet, base: "starter.admin.low", needs: ["defaulters_export"] },
    { id: "tests", Icon: FileText, base: "starter.admin.tests", needs: [] },
  ],
  hod: [
    { id: "compare", Icon: BarChart3, base: "starter.hod.compare", needs: [] },
    { id: "attendance", Icon: CalendarCheck, base: "starter.hod.attendance", needs: [] },
    { id: "low", Icon: FileSpreadsheet, base: "starter.hod.low", needs: ["defaulters_export"] },
    { id: "tests", Icon: FileText, base: "starter.hod.tests", needs: [] },
  ],
  proctor: [
    { id: "low", Icon: FileSpreadsheet, base: "starter.proctor.low", needs: ["batch", "defaulters_export"] },
    { id: "attendance", Icon: CalendarCheck, base: "starter.proctor.attendance", needs: ["batch"] },
    { id: "absent", Icon: AlertTriangle, base: "starter.proctor.absent", needs: ["batch"] },
    { id: "scope", Icon: ListChecks, base: "starter.proctor.scope", needs: [] },
  ],
  teacher: [
    { id: "attendance", Icon: Users, base: "starter.teacher.attendance", needs: ["batch"] },
    { id: "test", Icon: GraduationCap, base: "starter.teacher.test", needs: ["paper_generation"] },
    { id: "low", Icon: AlertTriangle, base: "starter.teacher.low", needs: ["batch"] },
    { id: "marks", Icon: ClipboardList, base: "starter.teacher.marks", needs: ["batch"] },
  ],
};

const card = (s: Starter, t: TFn): Suggestion => ({
  id: s.id, Icon: s.Icon,
  title: t(`${s.base}.title` as AgentKey), hint: t(`${s.base}.hint` as AgentKey), prompt: t(`${s.base}.prompt` as AgentKey),
});

/** The role's starters as plain suggestions (typeahead templates use the prompts). Pure. */
export function suggestionsFor(role: StaffRole, t: TFn = hx): Suggestion[] {
  return STARTERS[role].map((s) => card(s, t));
}

export interface ScopeOpts {
  t?: TFn;
  /** false = the user has NO batch (attendance / marks cannot work yet); null / undefined = unknown or not relevant */
  hasBatch?: boolean | null;
  features?: Features;
}

const featureOff = (needs: Need[], f: Features) =>
  needs.some((n) => (n === "paper_generation" || n === "defaulters_export") && f && f[n] === false);

/** Prompts the typeahead may offer: only starters that can work for this user right now. Pure. */
export function templatesFor(role: StaffRole, o: ScopeOpts = {}): string[] {
  const t = o.t ?? hx;
  return STARTERS[role].filter((s) => !featureOff(s.needs, o.features) && !(o.hasBatch === false && s.needs.includes("batch")))
    .map((s) => card(s, t).prompt);
}

/** "Teacher · 3 batch · 44 students" / "Admin · Poora institute" / "Teacher · Abhi koi batch assign nahi hai". Pure. */
export function scopeLine(role: StaffRole, batchCount: number | null, studentCount?: number | null, t: TFn = hx): string | null {
  if (role === "admin") return t("scope.admin");
  if (batchCount === null) return null;
  if (batchCount === 0) return t("scope.none");
  const b = t("scope.batches", { n: batchCount });
  if (typeof studentCount === "number" && studentCount > 0) return `${b} · ${t("scope.students", { n: studentCount })}`;
  return b;
}

/**
 * Four empty-state cards, ONE surface (the typeahead never repeats them on an empty box). Teachers: up to two of their
 * own batches first ("<name> ki attendance"), then role starters. A starter whose feature is off is left out; one that
 * needs a batch the user does not have is shown disabled with the reason, after the ones that work. Pure.
 */
export function emptyCards(role: StaffRole, batches: { name: string }[] = [], o: ScopeOpts = {}): Suggestion[] {
  const t = o.t ?? hx;
  const out: Suggestion[] = [];
  if (role === "teacher") {
    for (const b of batches.slice(0, 2)) {
      out.push({ id: `batch:${b.name}`, Icon: Users, title: t("starter.batch.title", { batch: b.name }), hint: t("starter.batch.hint"), prompt: t("starter.batch.prompt", { batch: b.name }) });
    }
  }
  const blocked: Suggestion[] = [];
  for (const s of STARTERS[role]) {
    if (featureOff(s.needs, o.features)) continue;
    const c = card(s, t);
    if (out.some((x) => x.prompt.toLowerCase() === c.prompt.toLowerCase())) continue;
    if (role === "teacher" && batches.length && s.id === "attendance") continue;
    if (o.hasBatch === false && s.needs.includes("batch")) blocked.push({ ...c, disabledReason: t("scope.needsBatch") });
    else out.push(c);
  }
  return [...out, ...blocked].slice(0, 4);
}
