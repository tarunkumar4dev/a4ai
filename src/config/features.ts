// src/config/features.ts
// Product switches. Flip a flag and rebuild — nothing here changes the database or any RLS policy.

/**
 * HOD / department-head and class-teacher (proctor) UI.
 * Coaching institutes have no HOD, so the simple flow is Admin → Teacher → Students.
 * false: /hod redirects to the user's dashboard, and every "HOD" / "class teacher (proctor)" control, badge,
 *        tab and text is hidden (Departments HOD card, Assign HOD, teacher HOD badge, "Class teacher" button,
 *        Batch settings proctor picker, teacher "My Section" tab).
 * true:  everything comes back exactly as before.
 * The server is unchanged either way: HOD / proctor rows, policies and RPCs keep working for existing users.
 */
export const HOD_ENABLED = false;

/** Class teacher (proctor) UI follows the HOD switch — it only makes sense with sections and department heads. */
export const PROCTOR_UI_ENABLED = HOD_ENABLED;

/** get_my_access().home_route, with /hod mapped to the teacher dashboard while the HOD UI is off. */
export function effectiveHomeRoute(route: string | null | undefined, hodEnabled = HOD_ENABLED): string {
  const r = route || "/dashboard";
  return !hodEnabled && (r === "/hod" || r.startsWith("/hod/")) ? "/dashboard" : r;
}

/**
 * Class → Subject → Batch → Teacher model (docs/design/class_subject_batch.md). Default OFF: production is unchanged.
 * true:  institute dashboard gets a "Classes" tree screen (one screen: class → subjects → batches → teacher), the Teachers
 *        tab becomes a read-only "Class → Subject → Batch" list with one "Add batch" picker (no department dropdown, no
 *        "+ Subject" dropdown), sections are hidden for institutes with hierarchy_mode = 'simple', and bulk upload can match
 *        batches per subject (optional "Subject" column).
 * Needs migrations 39 (+ the backfill) and 40 on the database. The server accepts both models; nothing here changes RLS.
 */
export const CLASS_SUBJECT_BATCH_ENABLED = false;

/** Sections are only shown when the flag is off or the institute is a 'full' (college) hierarchy. */
export function sectionsVisible(hierarchyMode: string | null | undefined, enabled = CLASS_SUBJECT_BATCH_ENABLED): boolean {
  return !enabled || hierarchyMode === "full";
}
