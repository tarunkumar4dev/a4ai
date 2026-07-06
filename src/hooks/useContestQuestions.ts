// hooks/useContestQuestions.ts
// The old Supabase-query hook is removed. Contest questions now come from the
// backend /start call inside ContestLivePage. This file only exports the
// ContestQuestion type, which QuestionPanel imports.

export type ContestQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  question_type: "MCQ" | "SHORT_ANSWER" | "LONG_ANSWER" | string;
  options: string[];            // plain option strings, e.g. ["4", "8", "12"]
  marks: number;
  difficulty?: string;
  chapter?: string | null;
  image_url?: string | null;    // kept optional so QuestionPanel's {q.image_url} check compiles
};