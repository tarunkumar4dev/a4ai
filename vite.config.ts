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
      strictPort: false,  // 👈 allow auto-switch to another port if 8080 is busy
      cors: true,        // fine in dev
      // Optional: uncomment if you access via LAN/IP and HMR has issues
      // hmr: { host: "localhost", protocol: "ws", port: 8080 },
    },
    preview: {
      port: 8080,        // 👈 preview build also same origin
      strictPort: false, // allow auto-switch if port is busy
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
      target: "es2020",
      sourcemap: mode === "development",
      minify: mode === "production" ? "esbuild" : false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-dom") || id.includes("react-router-dom") || id.includes("/react/")) {
                return "vendor-react";
              }
              if (id.includes("@dnd-kit")) {
                return "vendor-dnd";
              }
              if (id.includes("katex") || id.includes("react-katex")) {
                return "vendor-katex";
              }
              if (id.includes("jspdf") || id.includes("html2canvas")) {
                return "vendor-pdf";
              }
              if (id.includes("framer-motion")) {
                return "vendor-motion";
              }
              if (id.includes("lucide-react")) {
                return "vendor-icons";
              }
              if (id.includes("@supabase") || id.includes("@tanstack")) {
                return "vendor-data";
              }
            }
          },
        },
      },
    },
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV ?? "dev"),
    },
    css: {
      devSourcemap: true,
    },
  };
});