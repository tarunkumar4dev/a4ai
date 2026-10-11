// Student submission PDFs live in the PRIVATE `submissions` bucket (12_role_hardening).
// submissions.file_url keeps the ".../object/public/submissions/<path>" form (submit_assignment and the
// backend AI check parse it), so staff open the file through a short-lived signed URL made from that path.
// Storage RLS (a4_submissions_staff_read) decides who may sign it.
import { supabase } from "@/lib/supabaseClient";

const MARKER = "/storage/v1/object/public/submissions/";

export function submissionPath(fileUrl: string): string | null {
  const i = fileUrl.indexOf(MARKER);
  if (i < 0) return null;
  const path = decodeURIComponent(fileUrl.slice(i + MARKER.length).split("?")[0]);
  return path && !path.split("/").includes("..") ? path : null;
}

/** Opens a submission PDF in a new tab. Returns false if it can't be signed (no access / missing file). */
export async function openSubmissionFile(fileUrl: string): Promise<boolean> {
  const path = submissionPath(fileUrl);
  if (!path) return false;
  // Open the tab synchronously (inside the click) so popup blockers allow it, then point it at the URL.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("submissions").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    win?.close();
    return false;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.assign(data.signedUrl);
  return true;
}
