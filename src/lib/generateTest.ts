// /src/lib/history.ts
// v2 — reads from `tests` (the table backend actually writes to),
// filtered by logged-in teacher. `test_papers` was a dead legacy table.
import { supabase } from "@/lib/supabaseClient";

export type PaperRow = {
  id: string;
  created_at: string;
  exam_title: string | null;
  subject: string | null;
  board: string | null;
  class_grade: string | null;
  status: string | null;
  total_questions: number | null;
  total_marks: number | null;
};

export async function fetchRecentPapers(limit = 20): Promise<PaperRow[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // No silent fallback — surface it so the UI can show "please log in"
    throw new Error("Not logged in — cannot fetch test history");
  }

  const { data, error } = await supabase
    .from("tests")
    .select("id,created_at,exam_title,subject,board,class_grade,status,total_questions,total_marks")
    .eq("teacher_id", user.id)
    .eq("status", "saved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PaperRow[];
}