// End-to-end tests of the student upload link (npm run e2e). Supabase is mocked in the browser
// (tests/e2e/mockSupabase.ts) — no live DB, no backend. Unit tests: vitest.config.ts.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 5"], trace: "retain-on-failure" },
  webServer: {
    // the production bundle (no dev-server dependency re-optimising + reloading mid-test)
    command: `npx vite build --mode e2e --outDir dist-e2e && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort --host localhost`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,          // the build alone takes ~3 min on a slow (OneDrive) disk
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "http://mock.supabase.local", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
  },
});
