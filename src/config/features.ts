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
