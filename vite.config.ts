import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { UserConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  // Load environment variables (safely)
  const env = loadEnv(mode, process.cwd(), ["VITE_"]);

  return {
    server: {
      host: "::",
      port: 8080,
      // Enable stricter CORS in development if needed
      cors: true,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Production optimizations
    build: {
      sourcemap: mode === "development",
      minify: mode === "production" ? "esbuild" : false,
      chunkSizeWarningLimit: 1600,
    },
    // Environment variable handling
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    // CSS preprocessing
    css: {
      devSourcemap: true,
    },
  };
});