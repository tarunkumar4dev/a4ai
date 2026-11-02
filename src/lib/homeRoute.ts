// Where a signed-in user lands. Institute staff → get_my_access().home_route (the server decides).
// No institute membership (primary_role 'none') → the role they picked at signup (user_metadata.role).
// That role is UX only (the user can change it); RLS / backend JWT checks guard the data.
import type { AccessData } from "@/context/AccessProvider";

type AccessLike = Pick<AccessData, "primary_role" | "home_route"> | null | undefined;

export function resolveHomeRoute(access: AccessLike, signupRole: string | null | undefined): string {
  if (access && access.primary_role !== "none") return access.home_route || "/dashboard";
  const role = (signupRole || "").toLowerCase().trim();
  if (role === "student") return "/student/dashboard";
  // signed up as an institute but has none yet: /institute lets them create it (RoleRoute allowNewInstituteOwner)
  if (role === "institute") return "/institute";
  return "/dashboard";
}

/** A signed-up student with no institute role: never the teacher dashboard. */
export const isStudentOnly = (access: AccessLike, signupRole: string | null | undefined) =>
  !!access && access.primary_role === "none" && (signupRole || "").toLowerCase().trim() === "student";
