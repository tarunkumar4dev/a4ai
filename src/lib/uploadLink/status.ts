// src/lib/uploadLink/status.ts — attempt status → what students / teachers see (statuses: api doc §1).

export type AttemptStatus =
  | "uploaded" | "waiting_key" | "queued" | "checking" | "waiting_quota"
  | "checked" | "needs_review" | "published" | "failed" | "rejected"
  | "submitted" | "graded";                       // legacy portal v1 rows

export type ReviewReason = "empty_answer" | "illegible" | "low_confidence" | "key_missing" | "blank_pages" | "bad_scan";
export type CountPolicy = "latest" | "best";

export type StudentBadgeKind = "pending" | "checked" | "teacher" | "rejected" | "published";

export interface StudentBadge { kind: StudentBadgeKind; label: string; tone: "amber" | "blue" | "slate" | "red" | "green" }

/** Students never see "failed" as an error — for them it is still being checked (the teacher retries). */
export function studentBadge(status: string): StudentBadge {
  switch (status) {
    case "published": case "graded":
      return { kind: "published", label: "Result aa gaya", tone: "green" };
    case "checked": case "needs_review":
      return { kind: "checked", label: "Check ho gaya, teacher result bhejenge", tone: "blue" };
    case "waiting_key": case "waiting_quota":
      return { kind: "teacher", label: "Teacher ki taraf se pending hai", tone: "slate" };
    case "rejected":
      return { kind: "rejected", label: "File mein problem", tone: "red" };
    default:            // uploaded, queued, checking, failed, submitted
      return { kind: "pending", label: "Check ho raha hai ⏳", tone: "amber" };
  }
}

const FINAL: AttemptStatus[] = ["published", "rejected", "graded"];
export const isFinal = (s: string) => (FINAL as string[]).includes(s);
/** Poll while anything can still change for the student. */
export const needsPolling = (attempts: { status: string }[]) => attempts.some(a => !isFinal(a.status));

export const REVIEW_LABEL: Record<ReviewReason, string> = {
  empty_answer: "Khaali answer",
  illegible: "Padh nahi paya",
  low_confidence: "AI sure nahi",
  key_missing: "Answer key missing",
  blank_pages: "Khaali pages",
  bad_scan: "Photo kharab",
};

export interface TeacherBadge { label: string; tone: "amber" | "blue" | "slate" | "red" | "green" | "violet" }

export function teacherBadge(status: string): TeacherBadge {
  switch (status) {
    case "uploaded": case "queued": return { label: "Queue mein", tone: "amber" };
    case "checking": return { label: "Check ho raha hai", tone: "amber" };
    case "checked": return { label: "Checked", tone: "blue" };
    case "needs_review": return { label: "Review karein", tone: "violet" };
    case "published": case "graded": return { label: "Published", tone: "green" };
    case "failed": return { label: "Check fail", tone: "red" };
    case "rejected": return { label: "File reject", tone: "red" };
    case "waiting_key": return { label: "Key ka wait", tone: "slate" };
    case "waiting_quota": return { label: "Kal check hoga", tone: "slate" };
    default: return { label: status, tone: "slate" };
  }
}

/** Statuses publish_results blocks (api doc §3). */
export const IN_PIPELINE: AttemptStatus[] = ["uploaded", "queued", "checking", "waiting_key", "waiting_quota"];

/**
 * The attempt that counts per student (same rule as my_submissions):
 * latest = newest not rejected; best = highest published marks, else latest.
 */
export function pickCounted<T extends { attempt_no: number; status: AttemptStatus; marks: number | null }>(
  attempts: T[], policy: CountPolicy,
): T | null {
  const live = attempts.filter(a => a.status !== "rejected");
  if (policy === "best") {
    const pub = live.filter(a => a.status === "published" && a.marks != null)
      .sort((a, b) => (b.marks! - a.marks!) || (b.attempt_no - a.attempt_no));
    if (pub.length) return pub[0];
  }
  const latest = [...(live.length ? live : attempts)].sort((a, b) => b.attempt_no - a.attempt_no);
  return latest[0] ?? null;
}
