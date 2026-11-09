// a4ai Agent v2 end-to-end tests against the in-browser MOCK adapter (src/lib/agent/mock.ts): the bundle is built
// with VITE_AGENT_MOCK=1, so history, suggestions, feedback, cancel, regenerate/edit, my_scope and
// section_comparison all run without a backend. Supabase is still mocked per test (tests/e2e/agent-v2.spec.ts).
//   npx playwright test -c playwright.agent-mock.config.ts
//   AGENT_SHOTS=1 npx playwright test -c playwright.agent-mock.config.ts -g screenshots   → docs/screenshots/v2/
// Already built? E2E_REUSE=1 skips the build (serves dist-e2e-agent as is).
import { defineConfig, devices } from "@playwright/test";

const PORT = 4175;
const build = `npx vite build --mode e2e --outDir dist-e2e-agent`;
const serve = `npx vite preview --mode e2e --outDir dist-e2e-agent --port ${PORT} --strictPort --host localhost`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /agent-v2\.spec\.ts$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: process.env.E2E_REUSE ? serve : `${build} && ${serve}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "http://mock.supabase.local", VITE_SUPABASE_ANON_KEY: "test-anon-key", VITE_AGENT_MOCK: "1" },
  },
});
