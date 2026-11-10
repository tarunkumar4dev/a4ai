// UI audit screenshots — one-off; uses the same VITE_AGENT_MOCK=1 build as playwright.agent-mock.config.ts.
//   npx playwright test -c playwright.ui-audit.config.ts
// Reuse an existing build:
//   E2E_REUSE=1 npx playwright test -c playwright.ui-audit.config.ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 4176;
const build = `npx vite build --mode e2e --outDir dist-e2e-audit`;
const serve = `npx vite preview --mode e2e --outDir dist-e2e-audit --port ${PORT} --strictPort --host localhost`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /ui-audit-shots\.spec\.ts$/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.E2E_REUSE ? serve : `${build} && ${serve}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "http://mock.supabase.local",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_AGENT_MOCK: "1",
    },
  },
});
