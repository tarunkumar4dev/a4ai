#!/usr/bin/env node
// scripts/attach_email_to_user.mjs — give a phone-only account an email login, keeping the SAME user id
// (so tests, modules, memberships and subscriptions stay attached). Uses the Supabase Auth admin API —
// never a direct SQL UPDATE on auth.users.
//
//   node scripts/attach_email_to_user.mjs --user-id <uuid> --email <email>            # dry run (default)
//   node scripts/attach_email_to_user.mjs --user-id <uuid> --email <email> --apply    # really change it
//
// Env (never printed):
//   SUPABASE_SERVICE_ROLE_KEY   required — set it in the terminal only, never in a file:
//                                 PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "…"
//                                 afterwards:  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//                               A copy in .env / .env.local is ignored (warning printed, value never read out).
//   SUPABASE_URL                optional, falls back to VITE_SUPABASE_URL — the ONLY value read from
//                               .env / .env.local
//
// After --apply the user signs in with this email: "Forgot password" on /login sets a password,
// or Google works if the Google account uses the same email.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── args ────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
}
const userId = (arg("--user-id") || "").trim();
const email = (arg("--email") || "").trim().toLowerCase();
const APPLY = process.argv.includes("--apply");

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) fail("--user-id <uuid> is required");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("--email <valid email> is required");

// ── env ─────────────────────────────────────────────────────────────────────
// Files may provide VITE_SUPABASE_URL and nothing else. The service key comes only from the terminal.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let fileUrl = null;
for (const path of [".env", ".env.local"]) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1] === "SUPABASE_SERVICE_ROLE_KEY") {
      console.warn("⚠ Found SUPABASE_SERVICE_ROLE_KEY in a .env file — remove it; key is read only from the terminal.");
    } else if (m[1] === "VITE_SUPABASE_URL" && !fileUrl) {
      fileUrl = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileUrl;
if (!url) fail("SUPABASE_URL (or VITE_SUPABASE_URL) is not set");
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set — set it in the terminal: $env:SUPABASE_SERVICE_ROLE_KEY = "…" (never in a file)');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ── look up ─────────────────────────────────────────────────────────────────
const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
if (getErr || !got?.user) fail(`user ${userId} not found${getErr ? ` (${getErr.message})` : ""}`);
const user = got.user;
const last4 = (user.phone || "").replace(/\D/g, "").slice(-4);

const { data: profile, error: profErr } = await admin.from("profiles").select("id, role").eq("id", userId).maybeSingle();
if (profErr) fail(`profiles lookup failed: ${profErr.message}`);

console.log("User");
console.log(`  id            ${user.id}`);
console.log(`  phone         ${last4 ? `****${last4}` : "(none)"}`);
console.log(`  current email ${user.email || "(none)"}`);
console.log(`  profile row   ${profile ? `yes (role: ${profile.role ?? "null"})` : "NO"}`);
console.log(`  new email     ${email}`);

if (user.email && user.email.toLowerCase() === email) {
  console.log("\nNothing to do: the user already has this email.");
  process.exit(0);
}
if (user.email) fail(`user already has a different email (${user.email}) — not overwriting it`);

// ── the email must not belong to anyone else ────────────────────────────────
const PER_PAGE = 1000;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
  if (error) fail(`listUsers failed: ${error.message}`);
  const taken = data.users.find((u) => u.id !== userId && (u.email || "").toLowerCase() === email);
  if (taken) fail(`email ${email} already belongs to another user (${taken.id}) — aborting`);
  if (data.users.length < PER_PAGE) break;
}
console.log("  email free    yes");

if (!APPLY) {
  console.log("\nDRY RUN — nothing changed. Re-run with --apply to attach the email.");
  process.exit(0);
}

// ── apply ───────────────────────────────────────────────────────────────────
const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
if (updErr) fail(`update failed: ${updErr.message}`);
console.log(`\n✔ Email attached: ${upd.user.email} (confirmed). Same user id, all data kept.`);
console.log("  Next: the user opens /login → \"Forgot password\" with this email to set a password (or uses Google with it).");
