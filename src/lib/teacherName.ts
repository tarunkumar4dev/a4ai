// src/lib/teacherName.ts
// One display rule for staff names: real name → email prefix → "Unnamed teacher".
// Never show a UUID fragment ("Teacher 3d9b35e3") — it means nothing to an admin.

type NameSource = {
  user_name?: string | null;
  full_name?: string | null;
  displayName?: string | null;
  username?: string | null;
  user_email?: string | null;
  email?: string | null;
};

export function teacherDisplayName(m: NameSource | null | undefined): string {
  if (!m) return "Unnamed teacher";
  const name = [m.user_name, m.full_name, m.displayName, m.username].find(v => v && v.trim());
  if (name) return name.trim();
  const email = [m.user_email, m.email].find(v => v && v.includes("@"));
  if (email) return email.split("@")[0];
  return "Unnamed teacher";
}
