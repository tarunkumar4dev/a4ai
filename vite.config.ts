import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { UserConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), ["VITE_"]);

  return {
    server: {
      host: "::",        // ok (IPv6 + localhost). If needed, use "localhost" or "0.0.0.0"
      port: 8080,        // keep login + callback on this origin
      strictPort: true,  // 👈 critical: never auto-switch to another port
      cors: true,        // fine in dev
      // Optional: uncomment if you access via LAN/IP and HMR has issues
      // hmr: { host: "localhost", protocol: "ws", port: 8080 },
    },
    preview: {
      port: 8080,        // 👈 preview build also same origin
      strictPort: true,
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
    build: {
      sourcemap: mode === "development",
      minify: mode === "production" ? "esbuild" : false,
      chunkSizeWarningLimit: 1600,
    },
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV ?? "dev"),
    },
    css: {
      devSourcemap: true,
    },
  };
});