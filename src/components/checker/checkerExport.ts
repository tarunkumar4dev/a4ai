// src/components/checker/checkerExport.ts
// "Export Results" for a Check Copies session → one-sheet .xlsx, built in the browser from check_sheets.
// SheetJS is loaded only when the teacher exports (keeps it out of the page bundle).

import { effectiveMarks, effectiveTotal } from "./AiGradeBreakdown";
import type { CheckSession, CheckSheet } from "./copyCheckerApi";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Total that counts for a copy: the approved marks, else the AI total with the teacher's changes. */
export function sheetTotal(s: CheckSheet): number | null {
  if (s.status === "approved" && s.final_marks != null) return Number(s.final_marks);
  return s.ai_result ? effectiveTotal(s.ai_result) : null;
}

export function questionNumbers(session: CheckSession, sheets: CheckSheet[]): string[] {
  const fromRubric = session.rubric?.questions.map(q => q.q_no) ?? [];
  if (fromRubric.length) return fromRubric;
  const seen: string[] = [];
  for (const s of sheets) for (const q of s.ai_result?.graded_questions ?? []) if (!seen.includes(q.q_no)) seen.push(q.q_no);
  return seen;
}

export async function exportSessionResults(session: CheckSession, sheets: CheckSheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const qNos = questionNumbers(session, sheets);
  const header = ["Student Name", "Roll No", "Total Marks Awarded", "Max Marks", "Percentage",
    ...qNos.map(q => `Q${q} Marks`), "Overall Remarks (AI)"];

  const rows = sheets.map(s => {
    const r = s.ai_result;
    const total = sheetTotal(s);
    const max = Number(s.max_marks ?? r?.max_marks ?? session.total_marks ?? 0) || null;
    const byQ = new Map((r?.graded_questions ?? []).map(q => [q.q_no, q]));
    return [
      s.student_name,
      s.roll_no ?? "",
      total ?? "",
      max ?? "",
      total != null && max ? round1((total / max) * 100) : "",
      // an OR-alternative that doesn't count stays empty, so the row adds up to the total
      ...qNos.map(q => { const g = byQ.get(q); return g && g.counted !== false ? effectiveMarks(g) : ""; }),
      r?.overall_remarks ?? "",
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, ...qNos.map(() => ({ wch: 9 })), { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  const name = session.title.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "check";
  const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local date
  XLSX.writeFile(wb, `${name}_${date}_results.xlsx`);
}
