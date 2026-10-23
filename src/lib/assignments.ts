// src/lib/assignments.ts — the assignment write paths shared by the Assignments form (TeacherAssignmentsTab) and the
// "📸 Checking Link" from a test: question paper → public "assignments" bucket, answer key → PRIVATE "answer-keys"
// bucket + its assignment_ai_keys row (students never see the key).

import { supabase } from "@/lib/supabaseClient";

export type Strictness = "easy" | "medium" | "hard" | "extreme";

/** Question paper / attachment students may open. Returns the public URL + file name. */
export async function uploadAssignmentFile(folder: string, file: Blob, fileName: string): Promise<{ url: string; name: string }> {
  const path = `${folder}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage.from("assignments").upload(path, file, { contentType: "application/pdf" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("assignments").getPublicUrl(path);
  return { url: publicUrl, name: fileName };
}

/** Answer key for the AI check. A new file = a new key version (18: assignment_ai_keys.version trigger). */
export async function attachAnswerKey(assignmentId: string, userId: string, file: Blob, fileName: string,
                                      strictness: Strictness = "medium"): Promise<void> {
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const keyPath = `${userId}/${assignmentId}/${Date.now()}_${safe}`;
  const { error: kErr } = await supabase.storage.from("answer-keys")
    .upload(keyPath, file, { contentType: file.type || "application/pdf", upsert: false });
  if (kErr) throw new Error(`Answer key upload failed: ${kErr.message}`);
  const { error: rowErr } = await supabase.from("assignment_ai_keys").upsert({
    assignment_id: assignmentId, answer_key_path: keyPath, answer_key_name: fileName,
    strictness, rubric: null, rubric_source: null,
    updated_by: userId, updated_at: new Date().toISOString(),
  });
  if (rowErr) throw new Error(`Answer key save failed: ${rowErr.message}`);
}
