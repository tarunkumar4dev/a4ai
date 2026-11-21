// Activity labels (step timeline + the one aria-live status line) from the agent dictionaries. Its own module, so
// the store / chat reducer (in the initial bundle via the launcher) never pull the dictionaries in.
import { translate, type AgentKey, type AgentLang } from "./i18n";

const STEP_KEYS = new Set([
  "tool.resolve_entity", "tool.attendance_stats", "tool.low_attendance_list", "tool.attendance_trend", "tool.marks_stats",
  "tool.tests_created_by_teacher", "tool.blueprint_defaults", "tool.generate_questions", "tool.verify_paper",
  "tool.regenerate_failed", "tool.save_draft", "tool.finalize_test", "tool.assign_to_section", "tool.export_pdf",
  "tool.my_scope", "tool.section_comparison", "status.thinking", "status.querying", "status.retrieving_ncert",
  "status.generating", "status.verifying", "status.regenerating",
]);

export function stepLabel(key: string, params: Record<string, unknown> = {}, lang: AgentLang = "hinglish"): string {
  const t = (k: string, p?: Record<string, string | number>) => translate(lang, k as AgentKey, p);
  const base = STEP_KEYS.has(key) ? t(`step.${key}`) : t("step.default");
  if (key === "status.generating" && typeof params.n === "number") return t("step.status.generatingN", { n: params.n });
  if (key === "status.verifying" && typeof params.round === "number" && params.round > 1) return `${base} · ${t("step.round", { n: params.round })}`;
  if (key === "status.regenerating") {
    const n = Array.isArray(params.ids) ? params.ids.length : typeof params.count === "number" ? params.count : null;
    if (n) return t("step.status.regeneratingN", { n });
  }
  return base;
}

