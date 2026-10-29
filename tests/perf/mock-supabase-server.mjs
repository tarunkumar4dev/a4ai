// Tiny stand-in for Supabase (RPC + Storage) so Lighthouse can load /s/:token against a production build
// (tests/perf/lighthouse.mjs). Same shapes as tests/e2e/mockSupabase.ts / docs/upload-flow-api.md.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 54399);
const assignment = {
  id: "asg-1", title: "Physics Unit Test 2", instructions: "Upload all pages in order", batch_name: "ECE-2",
  opens_at: null, closes_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), grace_minutes: 2,
  late_policy: "accept_flag", count_policy: "latest", max_attempts: 2,
  allowed_mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"], max_mb: 10, max_pages: 30, max_marks: 40,
};

const rpc = {
  get_assignment_link: a => ({ state: "open", server_time: new Date().toISOString(), assignment,
    ...(a.p_code ? { student: { state: "ok", name: "Asha Verma", attempts_used: 0, attempts_left: 2 } } : {}) }),
  verify_access_code: () => ({ state: "ok", student: { name: "Asha Verma", class_level: "12", section_name: "ECE-2" } }),
  get_student_by_code: () => ({ id: "stu-1", institute_id: "inst-1", name: "Asha Verma" }),
  my_submissions: () => ({ state: "ok", assignment: { id: "asg-1", title: assignment.title, max_attempts: 2, count_policy: "latest" },
    attempts_used: 0, attempts_left: 2, attempts: [] }),
};

http.createServer((req, res) => {
  const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*",
                    "content-type": "application/json" };
  if (req.method === "OPTIONS") { res.writeHead(204, headers); return res.end(); }
  let body = "";
  req.on("data", c => { body += c; });
  req.on("end", () => {
    const m = req.url.match(/^\/rest\/v1\/rpc\/(\w+)/);
    const out = m && rpc[m[1]] ? rpc[m[1]](body ? JSON.parse(body) : {}) : req.url.startsWith("/rest/") ? [] : {};
    res.writeHead(200, headers);
    res.end(JSON.stringify(out));
  });
}).listen(PORT, () => console.log(`mock supabase on http://localhost:${PORT}`));
