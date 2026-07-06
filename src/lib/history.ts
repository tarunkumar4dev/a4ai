// /src/lib/history.ts
// v2 — reads from `tests` table (the table backend actually writes to),
// filtered by logged-in teacher. `test_papers` was a dead legacy table.
// Shows ALL statuses (draft/saved) so teachers see results immediately.
import { supabase } from "@/lib/supabaseClient";

export type PaperRow = {
  id: string;
  created_at: string;
  exam_title: string | null;
  subject: string | null;
  board: string | null;
  class_grade: string | null;
  status: string | null; // "draft" or "saved"
  total_questions: number | null;
  total_marks: number | null;
};

/**
 * Fetch ALL test papers for the current logged-in teacher
 * Shows both draft and saved tests so teachers see immediate results
 */
export async function fetchRecentPapers(limit = 50): Promise<PaperRow[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not logged in — cannot fetch test history");
  }

  // NO status filter — show ALL papers (draft + saved)
  const { data, error } = await supabase
    .from("tests")
    .select("id,created_at,exam_title,subject,board,class_grade,status,total_questions,total_marks")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching test history:", error);
    throw error;
  }

  return (data ?? []) as PaperRow[];
}

/**
 * Fetch only saved (completed) tests — useful for stats/analytics
 */
export async function fetchSavedPapers(limit = 20): Promise<PaperRow[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not logged in — cannot fetch saved tests");
  }

  const { data, error } = await supabase
    .from("tests")
    .select("id,created_at,exam_title,subject,board,class_grade,status,total_questions,total_marks")
    .eq("teacher_id", user.id)
    .eq("status", "saved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching saved tests:", error);
    throw error;
  }

  return (data ?? []) as PaperRow[];
}

/**
 * Get a single test paper by ID (only if it belongs to current user)
 */
export async function getTestPaperById(testId: string): Promise<PaperRow | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not logged in — cannot fetch test details");
  }

  const { data, error } = await supabase
    .from("tests")
    .select("id,created_at,exam_title,subject,board,class_grade,status,total_questions,total_marks")
    .eq("id", testId)
    .eq("teacher_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // No rows returned
    }
    console.error("Error fetching test details:", error);
    throw error;
  }

  return data as PaperRow;
}

/**
 * Delete a test paper by ID (only if it belongs to current user)
 * NOTE: requires ON DELETE CASCADE on questions.test_id FK,
 * otherwise question rows will be orphaned.
 */
export async function deleteTestPaper(testId: string): Promise<boolean> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not logged in — cannot delete test");
  }

  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", testId)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("Error deleting test:", error);
    throw error;
  }

  return true;
}

/**
 * Count tests by status for the current teacher
 */
export async function getTestCounts(): Promise<{ total: number; draft: number; saved: number }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not logged in — cannot count tests");
  }

  const { count: total, error: totalError } = await supabase
    .from("tests")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", user.id);

  if (totalError) {
    console.error("Error counting total tests:", totalError);
    throw totalError;
  }

  const { count: draft, error: draftError } = await supabase
    .from("tests")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("status", "draft");

  if (draftError) {
    console.error("Error counting draft tests:", draftError);
    throw draftError;
  }

  const { count: saved, error: savedError } = await supabase
    .from("tests")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("status", "saved");

  if (savedError) {
    console.error("Error counting saved tests:", savedError);
    throw savedError;
  }

  return {
    total: total || 0,
    draft: draft || 0,
    saved: saved || 0,
  };
}