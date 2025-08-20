import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  KeyRound,
  ShieldCheck,
  Globe,
  Code2,
  Server,
  Webhook as WebhookIcon,
  AlertTriangle,
  Terminal,
  BookOpen,
  Link2,
  Lock,
  Rocket,
  Copy,
  Check,
  Zap,
} from "lucide-react";

/*
  ApiPage — a4ai
  - Modern, OpenAI‑style API page (animated)
  - Hero + quickstart + REST/SDK tabs + endpoint showcase
  - Webhooks, errors, rate limits, and status section
  - Self‑contained (no extra libs beyond Tailwind + shadcn/ui + Framer Motion)
*/

// ----------------------------- Utilities -----------------------------

function Chip({ children, intent = "default" as "default" | "success" | "warning" | "info" }) {
  const map = {
    default: "bg-muted text-foreground/90",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[intent]}`}>{children}</span>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="relative">
      <button onClick={copy} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-xs hover:bg-muted">
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed"><code className={`language-${lang}`}>{code}</code></pre>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// Example snippets -----------------------------------

const CURL_QUICKSTART = `# Base URL
export BASE=https://api.a4ai.in/v1

# Generate a test paper (Science, Class 10)
curl -X POST "$BASE/tests/generate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Science",
    "class": 10,
    "chapters": ["Electricity", "Human Eye"],
    "difficulty": "mixed",
    "num_questions": 20,
    "format": "pdf"
  }'
`;

const SDK_INSTALL = `# pick one
npm i @a4ai/sdk
# yarn add @a4ai/sdk
# pnpm add @a4ai/sdk`;

const SDK_TS = `import { A4AI } from "@a4ai/sdk";

const client = new A4AI({ apiKey: process.env.A4AI_API_KEY! });

const test = await client.tests.generate({
  subject: "Science",
  class: 10,
  chapters: ["Electricity", "Human Eye"],
  difficulty: "mixed",
  num_questions: 20,
  format: "pdf",
});

console.log(test.id, test.downloadUrl);
`;

const ENDPOINT_GENERATE_REQ = `POST /v1/tests/generate
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "subject": "Mathematics",
  "class": 10,
  "chapters": ["Trigonometry"],
  "difficulty": "balanced",
  "blueprint": { "mcq": 10, "short": 5, "long": 5 },
  "num_questions": 20,
  "format": "pdf"
}`;

const ENDPOINT_GENERATE_RES = `200 OK
{
  "id": "tst_9xq2k...",
  "status": "ready",
  "downloadUrl": "https://cdn.a4ai.in/tests/tst_9xq2k.pdf",
  "meta": {
    "subject": "Mathematics",
    "class": 10,
    "chapters": ["Trigonometry"],
    "createdAt": "2025-08-20T12:22:33Z"
  }
}`;

const ENDPOINT_CONTEST_REQ = `POST /v1/contests
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "name": "Class X Science Sprint",
  "code": "ClassX_Science",
  "startAt": "2025-08-25T09:30:00+05:30",
  "durationMinutes": 45,
  "proctoring": { "camera": true, "screenLock": true }
}`;

const ENDPOINT_CONTEST_RES = `201 Created
{
  "id": "cst_8pLmx...",
  "url": "https://a4ai.in/contests/cst_8pLmx",
  "adminUrl": "https://a4ai.in/admin/contests/cst_8pLmx",
  "proctoring": { "camera": true, "screenLock": true }
}`;

const WEBHOOK_PAYLOAD = `{
  "id": "evt_7w2...",
  "type": "contest.proctor.alert",
  "created": 1692851200,
  "data": {
    "contestId": "cst_8pLmx",
    "studentId": "stu_92d...",
    "alerts": [
      { "code": "face_missing", "severity": "high" },
      { "code": "screen_change", "severity": "medium" }
    ]
  },
  "signature": "t=1692851200,v1=..."
}`;

// ----------------------------- Component -----------------------------

export default function ApiPage() {
  const [tab, setTab] = useState<"rest" | "sdk">("rest");
  const headerGradient = useMemo(
    () =>
      "bg-[radial-gradient(1200px_600px_at_50%_-10%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(900px_500px_at_80%_0%,hsl(var(--primary)/0.12),transparent_60%)]",
    []
  );

  return (
    <div className="relative">
      {/* Animated background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className={`absolute inset-0 ${headerGradient}`}
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-18">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur">
            <KeyRound className="h-4 w-4" />
            <span className="font-medium">a4ai API</span>
            <Chip intent="info">v1</Chip>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Build with a4ai</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Generate tests, host proctored contests, and analyze performance with a clean REST API and a TypeScript SDK.
            Secure, scalable, and designed for institutes and indie builders alike.
          </p>

          {/* Base URL + Auth */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Globe className="h-4 w-4" /> Base URL</div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-md border bg-muted/40 p-3 text-sm font-mono">https://api.a4ai.in/v1</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Authentication</div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  Send <span className="font-mono">Authorization: Bearer YOUR_API_KEY</span> with each request.
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* Quickstart */}
      <section className="mx-auto max-w-6xl px-4">
        <SectionTitle icon={<Terminal className="h-5 w-5" />} title="Quickstart" subtitle="Choose REST or the TypeScript SDK" />

        <div className="mb-3 inline-flex rounded-lg border p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "rest" ? "bg-muted" : "opacity-70 hover:opacity-100"}`}
            onClick={() => setTab("rest")}
          >
            REST (curl)
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "sdk" ? "bg-muted" : "opacity-70 hover:opacity-100"}`}
            onClick={() => setTab("sdk")}
          >
            TypeScript SDK
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {tab === "rest" ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Code2 className="h-4 w-4" /> REST example</div>
                <h3 className="text-lg font-semibold tracking-tight">Generate a test</h3>
              </CardHeader>
              <CardContent>
                <CodeBlock code={CURL_QUICKSTART} lang="bash" />
              </CardContent>
              <CardFooter>
                <Button size="sm" className="gap-2"><Rocket className="h-4 w-4" /> Try in your terminal</Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Server className="h-4 w-4" /> SDK install</div>
                <h3 className="text-lg font-semibold tracking-tight">Use the TypeScript SDK</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock code={SDK_INSTALL} lang="bash" />
                <CodeBlock code={SDK_TS} lang="ts" />
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline" className="gap-2"><Link2 className="h-4 w-4" /> View reference</Button>
              </CardFooter>
            </Card>
          )}

          {/* API Key panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Your API key</div>
              <h3 className="text-lg font-semibold tracking-tight">Keep it secret</h3>
            </CardHeader>
            <CardContent>
              <ApiKeyBox />
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Store keys as environment variables, never commit to Git.</li>
                <li>Use different keys for development and production.</li>
                <li>Rotate if you suspect exposure.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Endpoints showcase */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle icon={<BookOpen className="h-5 w-5" />} title="Endpoints" subtitle="Popular endpoints at a glance" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Generate Test */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/40 px-6 py-3 text-sm font-medium">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-primary">POST</span>
              <span className="ml-2 font-mono">/v1/tests/generate</span>
            </div>
            <CardContent className="grid gap-4 pt-4">
              <p className="text-sm text-muted-foreground">Create a test paper with chapters, difficulty, and blueprint controls. Returns a downloadable asset.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <CodeBlock code={ENDPOINT_GENERATE_REQ} lang="http" />
                <CodeBlock code={ENDPOINT_GENERATE_RES} lang="json" />
              </div>
            </CardContent>
          </Card>

          {/* Create Contest */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/40 px-6 py-3 text-sm font-medium">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-primary">POST</span>
              <span className="ml-2 font-mono">/v1/contests</span>
            </div>
            <CardContent className="grid gap-4 pt-4">
              <p className="text-sm text-muted-foreground">Schedule a proctored live contest with camera checks and screen‑lock.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <CodeBlock code={ENDPOINT_CONTEST_REQ} lang="http" />
                <CodeBlock code={ENDPOINT_CONTEST_RES} lang="json" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* More endpoints mini list */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <EndpointPill method="GET" path="/v1/questions/search" desc="Search the question bank" />
          <EndpointPill method="GET" path="/v1/tests/{id}" desc="Fetch a test by id" />
          <EndpointPill method="POST" path="/v1/tests/{id}/export" desc="Re‑export as PDF/DOCX" />
          <EndpointPill method="GET" path="/v1/contests/{id}/results" desc="Contest results & rankings" />
          <EndpointPill method="POST" path="/v1/contests/{id}/invite" desc="Invite students by email" />
          <EndpointPill method="DELETE" path="/v1/keys/{id}" desc="Revoke an API key" />
        </div>
      </section>

      {/* Webhooks */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <SectionTitle icon={<WebhookIcon className="h-5 w-5" />} title="Webhooks" subtitle="Receive real‑time events from a4ai" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-sm text-muted-foreground">Events</div>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="grid list-disc gap-2 pl-5">
                <li><span className="font-mono">test.ready</span> — a generated test is available</li>
                <li><span className="font-mono">contest.started</span> — a contest begins</li>
                <li><span className="font-mono">contest.finished</span> — a contest ends
                </li>
                <li><span className="font-mono">contest.proctor.alert</span> — a proctoring rule was triggered</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-muted-foreground">Example payload</div>
            </CardHeader>
            <CardContent>
              <CodeBlock code={WEBHOOK_PAYLOAD} lang="json" />
              <p className="mt-2 text-xs text-muted-foreground">Verify signatures with your webhook secret and the <span className="font-mono">t</span>/<span className="font-mono">v1</span> values.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Rate limits & Errors */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4" /> Rate limits</div>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="grid list-disc gap-2 pl-5">
                <li><span className="font-mono">/tests/generate</span>: 60 req/min, burst 120</li>
                <li><span className="font-mono">/contests</span>: 20 req/min</li>
                <li>Headers include <span className="font-mono">X-RateLimit-Remaining</span> and <span className="font-mono">X-RateLimit-Reset</span>.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Errors</div>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="grid list-disc gap-2 pl-5">
                <li><span className="font-mono">400 Bad Request</span> — invalid params</li>
                <li><span className="font-mono">401 Unauthorized</span> — missing/invalid API key</li>
                <li><span className="font-mono">403 Forbidden</span> — plan doesn’t allow this action</li>
                <li><span className="font-mono">429 Too Many Requests</span> — rate limit exceeded</li>
                <li><span className="font-mono">500 Server Error</span> — unexpected error (retry with backoff)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Callout + Links */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-xl border bg-muted/40 p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Ready to launch?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Spin up your first test in minutes, then wire contests and webhooks for end‑to‑end workflows.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-2"><Rocket className="h-4 w-4" /> Get API key</Button>
              <Button size="sm" variant="outline" className="gap-2"><BookOpen className="h-4 w-4" /> Full docs</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ----------------------------- Small components -----------------------------

function ApiKeyBox() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = show ? "sk_live_51Hh...YourRealKey" : "sk_live_••••••••••••••••••••••";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText("sk_live_51Hh...YourRealKey");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
      <div className="font-mono text-sm">{key}</div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</Button>
        <Button size="sm" onClick={copy} className="gap-1">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function EndpointPill({ method, path, desc }: { method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH"; path: string; desc: string }) {
  const color = method === "GET" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : method === "POST" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : method === "DELETE" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" : method === "PUT" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color} border`}>{method}</span>
        <span className="font-mono text-sm">{path}</span>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
