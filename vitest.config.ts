// Unit tests (npm test). Browser end-to-end tests live in tests/e2e (npm run e2e, Playwright).
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    env: { VITE_SUPABASE_URL: "http://mock.supabase.local", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
  },
});
