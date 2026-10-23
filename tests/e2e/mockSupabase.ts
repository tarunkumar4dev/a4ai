// In-browser stand-in for Supabase (RPCs + Storage) for the upload-link e2e tests. Shapes follow
// docs/upload-flow-api.md. Every request to http://mock.supabase.local is answered here.
import type { Page, Route } from "@playwright/test";

export const TOKEN = "tok-1";
export const CODE = "ABCD2345";
const ASG = "asg-1", INST = "inst-1", STUDENT = "stu-1";

type Attempt = {
  id: string; attempt_no: number; label: string; status: string; is_late: boolean; counts: boolean; submitted_at: string;
  files: { page_order: number; mime: string; size: number }[]; reject_reasons: unknown[]; result: unknown;
};

export class MockSupabase {
  linkState = "open";
  maxAttempts = 3;
  verifyLocked = false;
  createDelayMs = 0;
  /** Storage: fail every upload after this many successful ones (null = never) */
  failUploadsAfter: number | null = null;
  uploads: { path: string; ok: boolean; size: number }[] = [];
  createCalls: { key: string; files: { storage_path: string; mime: string; page_order: number }[] }[] = [];
  attempts: Attempt[] = [];
  private keys = new Map<string, Attempt>();

  get okUploads() { return this.uploads.filter(u => u.ok); }

  /** What the worker + teacher would do: the attempt is checked, then the result published. */
  publish(marks: number, max: number) {
    for (const a of this.attempts) {
      a.status = "published";
      a.result = {
        marks, max_marks: max, percentage: Math.round((marks / max) * 100), feedback: "Well written",
        published_at: new Date().toISOString(),
        per_question: [
          { q_no: "1", max_marks: 4, marks: 3, counted: true, not_attempted: false, feedback: "Correct formula", confidence: "high" },
          { q_no: "2", max_marks: 6, marks: marks - 3, counted: true, not_attempted: false, feedback: "Unit missing", confidence: "medium" },
        ],
      };
    }
  }

  private assignment() {
    const closes = this.linkState === "open_late" || this.linkState === "closed"
      ? new Date(Date.now() - 3_600_000).toISOString() : new Date(Date.now() + 2 * 86_400_000).toISOString();
    return {
      id: ASG, title: "Physics Unit Test 2", instructions: "Upload all pages in order", batch_name: "ECE-2",
      opens_at: null, closes_at: closes, grace_minutes: 2, late_policy: "accept_flag", count_policy: "latest",
      max_attempts: this.maxAttempts, allowed_mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      max_mb: 10, max_pages: 30, max_marks: 10,
    };
  }

  private used() { return this.attempts.filter(a => a.status !== "rejected").length; }

  private rpc(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case "get_assignment_link": {
        if (this.linkState === "not_found") return { state: "not_found" };
        if (this.linkState === "inactive") return { state: "inactive", title: "Physics Unit Test 2" };
        const out: Record<string, unknown> = { state: this.linkState, server_time: new Date().toISOString(), assignment: this.assignment() };
        if (args.p_code) out.student = { state: "ok", name: "Asha Verma", attempts_used: this.used(), attempts_left: this.maxAttempts - this.used() };
        return out;
      }
      case "verify_access_code":
        if (this.verifyLocked) return { state: "locked", scope: "ip", retry_after_sec: 900 };
        return args.p_code === CODE
          ? { state: "ok", student: { name: "Asha Verma", roll_no: "1", class_level: "12", section_name: "ECE-2", batch_name: "ECE-2",
                                      lab_batch_name: null, institute_name: "MSIT", email_masked: "a***@gmail.com" } }
          : { state: "invalid_code" };
      case "get_student_by_code":
        return args.p_code === CODE ? { id: STUDENT, institute_id: INST, name: "Asha Verma" } : null;
      case "create_submission": {
        const key = String(args.p_idempotency_key);
        const files = args.p_files as MockSupabase["createCalls"][number]["files"];
        this.createCalls.push({ key, files });
        const seen = this.keys.get(key);
        if (seen) return { state: "replayed", submission: seen };
        if (this.used() >= this.maxAttempts) return { state: "max_attempts", max_attempts: this.maxAttempts, attempts_used: this.used() };
        const n = this.attempts.length + 1;
        const a: Attempt = {
          id: `sub-${n}`, attempt_no: n, label: `Upload-${n}`, status: "queued", is_late: this.linkState === "open_late",
          counts: true, submitted_at: new Date().toISOString(),
          files: files.map(f => ({ page_order: f.page_order, mime: f.mime, size: 1000 })), reject_reasons: [], result: null,
        };
        this.attempts.forEach(x => { x.counts = false; });
        this.attempts.unshift(a);
        this.keys.set(key, a);
        return { state: "created", submission: a, warnings: [], attempts_left: this.maxAttempts - this.used() };
      }
      case "my_submissions":
        return { state: "ok", assignment: { id: ASG, title: "Physics Unit Test 2", max_attempts: this.maxAttempts, count_policy: "latest" },
                 attempts_used: this.used(), attempts_left: this.maxAttempts - this.used(), attempts: this.attempts };
      default:
        return null;
    }
  }

  async install(page: Page) {
    await page.route("http://mock.supabase.local/**", async (route: Route) => {
      const req = route.request();
      const url = new URL(req.url());
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/);
      if (rpc) {
        const args = req.postDataJSON() || {};
        if (rpc[1] === "create_submission" && this.createDelayMs) await new Promise(r => setTimeout(r, this.createDelayMs));
        return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(this.rpc(rpc[1], args)) });
      }
      const up = url.pathname.match(/^\/storage\/v1\/object\/submissions\/(.+)$/);
      if (up && req.method() === "POST") {
        const path = decodeURIComponent(up[1]);
        const size = req.postDataBuffer()?.length || 0;
        if (this.failUploadsAfter != null && this.okUploads.length >= this.failUploadsAfter) {
          this.uploads.push({ path, ok: false, size });
          return route.abort("internetdisconnected");
        }
        this.uploads.push({ path, ok: true, size });
        return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ Key: `submissions/${path}` }) });
      }
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: url.pathname.startsWith("/rest/") ? "[]" : "{}" });
    });
    // no analytics / external calls in tests
    // (only other hosts — the dev server's own /node_modules/.vite/deps/@vercel_*.js must load)
    await page.route(url => !["localhost", "mock.supabase.local"].includes(url.hostname), r => r.abort());
  }
}
