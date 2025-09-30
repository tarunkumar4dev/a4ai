// /src/lib/mapFormToEdge.ts
import type { TestGeneratorFormValues } from "@/components/TestGeneratorForm";
import type { GenerateTestRequest } from "@/types/testgen";

/** Clamp to 1..4 because the new sectioned orchestrator only accepts 1,2,3,4 marks/Q. */
function canUseSectionedMarks(m: number) {
  return [1, 2, 3, 4].includes(Number(m));
}

function toTitle(s?: string) {
  if (!s) return s;
  return s.replace(/\s+/g, " ").trim();
}

function classLabel(n: number) {
  return String(n);
}

export function buildEdgePayload(
  f: TestGeneratorFormValues,
  userId: string,
  requestId: string,
  ref_files: Array<{ name: string; path: string }>
): GenerateTestRequest {
  // Try to create sectionsJSON (preferred) when all sections/rows are 1..4 marks
  let sectionsJSON: string | undefined = undefined;

  if (f.patternMode === "blueprint") {
    const secs = f.sections || [];
    const canUse = secs.every(s => canUseSectionedMarks(s.marksPerQuestion));
    if (secs.length && canUse) {
      const sectioned = secs.map((s, idx) => ({
        id: String.fromCharCode(65 + idx),            // A, B, C ...
        marksPerQuestion: Number(s.marksPerQuestion), // 1|2|3|4
        count: Number(s.count),
        difficultyMix: { easy: 40, medium: 40, hard: 20 },
      }));
      sectionsJSON = JSON.stringify(sectioned);
    }
  }

  if (f.patternMode === "matrix") {
    const rows = f.markingMatrix || [];
    const canUse = rows.every(r => canUseSectionedMarks(r.marksPerQuestion));
    if (rows.length && canUse) {
      const sectioned = rows
        .filter(r => (r.count || 0) > 0)
        .map((r, idx) => ({
          id: String.fromCharCode(65 + idx),
          marksPerQuestion: Number(r.marksPerQuestion), // 1|2|3|4
          count: Number(r.count),
          difficultyMix: { easy: 40, medium: 40, hard: 20 },
        }));
      if (sectioned.length) sectionsJSON = JSON.stringify(sectioned);
    }
  }

  // computed totals (for PDF header)
  const computedTotalMarks = (() => {
    if (f.patternMode === "blueprint") {
      return String((f.sections || []).reduce((s, x) => s + (x.count || 0) * (x.marksPerQuestion || 0), 0));
    }
    if (f.patternMode === "matrix") {
      return String((f.markingMatrix || []).reduce((s, x) => s + (x.count || 0) * (x.marksPerQuestion || 0), 0));
    }
    return String((f.qCount || 0) * (f.marksPerQuestion || 0));
  })();

  // Legacy mapping (always provided for back-compat on the Edge)
  const legacy: any = {
    requestId,
    userId,
    board: f.board,
    classNum: f.classNum,
    subject: toTitle(f.subject) || "General",
    topics: f.topics || [],
    subtopics: f.subtopics || [],
    questionType: f.questionType,
    mode: f.mode,
    difficulty: f.difficulty,
    mix: f.mix,
    patternMode: f.patternMode,
    qCount: f.qCount,
    marksPerQuestion: f.marksPerQuestion,
    sections: f.sections,
    markingMatrix: f.markingMatrix,
    language: f.language,
    solutionStyle: f.solutionStyle,
    includeAnswerKey: f.includeAnswerKey ?? true,
    negativeMarking: f.negativeMarking ?? 0,
    shuffleQuestions: f.shuffleQuestions ?? true,
    shuffleOptions: f.shuffleOptions ?? true,
    notes: f.notes,
    outputFormat: f.outputFormat || "PDF",
    watermark: f.watermark ?? false,
    watermarkText: f.watermarkText,
    useLogo: f.useLogo ?? true,
    // header meta (optional)
    institute: "a4ai", // tweak if you have input
    teacherName: undefined,
    examTitle: `${toTitle(f.subject)} • Class ${classLabel(f.classNum)} • ${f.board}`,
    examDate: undefined,
    // new
    sectionsJSON,
    computedTotalMarks,
    ref_files,
  };

  return legacy as GenerateTestRequest;
}
