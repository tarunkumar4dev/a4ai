/// <reference lib="deno.unstable" />
// supabase/functions/send-whatsapp-otp/index.ts
//
// Supabase Auth "Send SMS Hook" → delivers the login OTP over WhatsApp (Meta Cloud API, authentication template)
// instead of Twilio SMS. Supabase still generates, expires and verifies the OTP (signInWithOtp / verifyOtp are
// unchanged on the frontend); this function only DELIVERS it.
//
// Flow: verify hook signature → normalise phone → per-number limit (a4_otp_rate_check) → WhatsApp template → 200.
// Any failure returns a hook error, so supabase.auth.signInWithOtp() returns an error to the page.
//
/* ========= ENV (supabase secrets set ...) =========
   SEND_SMS_HOOK_SECRET    "v1,whsec_…" — shown in Dashboard → Authentication → Hooks when the hook is created
   WHATSAPP_TOKEN          permanent system-user token (whatsapp_business_messaging)
   WHATSAPP_PHONE_NUMBER_ID  the a4ai sender number's Phone Number ID (NOT the Test account)
   WHATSAPP_OTP_TEMPLATE   default "a4ai_login_otp"  (category: Authentication, button: Copy code)
   WHATSAPP_OTP_LANG       default "en"               (template language code exactly as in WhatsApp Manager)
   WHATSAPP_GRAPH_VERSION  default "v21.0"
   OTP_HASH_PEPPER         optional extra secret mixed into the stored phone hash
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — provided by Supabase automatically
===================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const HOOK_SECRET = (Deno.env.get("SEND_SMS_HOOK_SECRET") || "").replace(/^v1,whsec_/, "");
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WA_TEMPLATE = Deno.env.get("WHATSAPP_OTP_TEMPLATE") || "a4ai_login_otp";
const WA_LANG = Deno.env.get("WHATSAPP_OTP_LANG") || "en";
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
const PEPPER = Deno.env.get("OTP_HASH_PEPPER") || "";
const META_TIMEOUT_MS = 4000; // Supabase waits ~5 s for an auth hook

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Auth-hook error shape. `message` is what the login page ends up showing. */
function hookError(httpCode: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { "Content-Type": "application/json" },
  });
}

/** Indian mobile → "91XXXXXXXXXX" (WhatsApp "to" format), else null. */
function normalizeIndianMobile(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length !== 10 || !/^[6-9]/.test(d)) return null;
  return `91${d}`;
}

const mask = (phone: string) => `******${phone.slice(-4)}`; // logs never contain the full number or the OTP

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Meta error → message for the user + whether it's our config problem. */
function explainMetaError(code: number | undefined): { message: string; config: boolean } {
  switch (code) {
    case 190: // token expired / invalid
    case 10: // permission denied
    case 200:
      return { message: "WhatsApp OTP is unavailable right now. Please sign in with Google or Email.", config: true };
    case 132000: // template param mismatch
    case 132001: // template doesn't exist (name / language)
    case 132005:
    case 132007:
    case 132012:
    case 132015: // template paused
    case 132016: // template disabled
      return { message: "WhatsApp OTP is unavailable right now. Please sign in with Google or Email.", config: true };
    case 131030: // recipient not in allowed list (test number)
      return { message: "WhatsApp OTP is unavailable right now. Please sign in with Google or Email.", config: true };
    case 130429: // throughput
    case 131048: // spam rate limit
    case 131056: // pair rate limit
      return { message: "Too many requests right now. Please try again in a minute.", config: false };
    case 131026: // undeliverable (usually not on WhatsApp)
      return { message: "This number is not on WhatsApp. Use your WhatsApp number or sign in with Google or Email.", config: false };
    default:
      return { message: "Could not send the OTP. Please try again shortly or sign in with Google or Email.", config: false };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return hookError(405, "Method not allowed");

  // 1) Only Supabase Auth may call this (Standard Webhooks signature). Otherwise anyone could spend our money.
  const payload = await req.text();
  if (!HOOK_SECRET) {
    console.error("send-whatsapp-otp: SEND_SMS_HOOK_SECRET not set");
    return hookError(500, "OTP service is not configured.");
  }
  let event: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    event = new Webhook(HOOK_SECRET).verify(payload, Object.fromEntries(req.headers)) as typeof event;
  } catch {
    return hookError(401, "Invalid signature");
  }

  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.error("send-whatsapp-otp: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set");
    return hookError(500, "WhatsApp OTP is unavailable right now. Please sign in with Google or Email.");
  }

  // 2) Validate input
  const otp = String(event.sms?.otp || "");
  const to = normalizeIndianMobile(String(event.user?.phone || ""));
  if (!/^\d{4,10}$/.test(otp)) return hookError(400, "Invalid OTP payload");
  if (!to) return hookError(400, "Enter a valid 10-digit Indian mobile number.");

  // 3) Per-number limit (server-side; the browser limiter can be bypassed)
  const { data: rate, error: rateErr } = await admin.rpc("a4_otp_rate_check", {
    p_phone_hash: await sha256Hex(`${PEPPER}:${to}`),
  });
  if (rateErr) {
    // Fail closed: without the limiter a script could burn through WhatsApp credits.
    console.error("send-whatsapp-otp: rate check failed", rateErr.message);
    return hookError(500, "Could not send the OTP. Please try again shortly.");
  }
  if (!rate?.allowed) {
    const wait = Number(rate?.retry_after_sec) || 60;
    const msg = rate?.reason === "too_soon"
      ? `You can request a new OTP in ${wait} seconds.`
      : rate?.reason === "hourly_limit"
        ? "Too many OTPs were sent to this number. Try again in an hour or sign in with Google or Email."
        : "This number has reached today's OTP limit. Try again tomorrow or sign in with Google or Email.";
    return hookError(429, msg);
  }

  // 4) Send the authentication template (body {{1}} = OTP, copy-code button param = OTP)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: WA_TEMPLATE,
          language: { code: WA_LANG },
          components: [
            { type: "body", parameters: [{ type: "text", text: otp }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
          ],
        },
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = body?.error?.code as number | undefined;
      const { message, config } = explainMetaError(code);
      console.error(
        `send-whatsapp-otp: Meta ${res.status} code=${code} ${config ? "[CONFIG]" : ""} to=${mask(to)}`,
        body?.error?.message || "",
      );
      return hookError(code === 130429 || code === 131056 ? 429 : 502, message);
    }

    // Accepted by Meta. Delivery can still fail later (e.g. number not on WhatsApp) — the page shows
    // "Didn't get the OTP?" help after 30 s for that case.
    console.log(`send-whatsapp-otp: sent to=${mask(to)} id=${body?.messages?.[0]?.id || "?"}`);
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    const timedOut = (e as Error)?.name === "AbortError";
    console.error(`send-whatsapp-otp: ${timedOut ? "Meta timeout" : "fetch failed"} to=${mask(to)}`, String(e));
    return hookError(504, "WhatsApp is responding slowly. Please try again.");
  } finally {
    clearTimeout(timer);
  }
});
