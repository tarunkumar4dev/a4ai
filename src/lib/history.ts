// /src/lib/history.ts
import { supabase } from "@/lib/supabaseClient";

export type PaperRow = {
  id: string;
  created_at: string;
  subject: string | null;
  board: string | null;
  grade: string | null;
  difficulty: string | null;
  question_type: string | null;
  q_count: number | null;
  pdf_url: string;
};

export async function fetchRecentPapers(limit = 20) {
  const { data, error } = await supabase
    .from("test_papers")
    .select("id,created_at,subject,board,grade,difficulty,question_type,q_count,pdf_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PaperRow[];
}
