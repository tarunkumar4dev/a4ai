// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/lite.css"; // no animations / blur (Play Store WebView speed)
import { installChunkReload } from "./lib/chunkReload";

/* ---------- Vercel Analytics inject() ---------- */
import { inject } from "@vercel/analytics";

if (import.meta.env.PROD) {
  inject(); // ✅ enable only in production
}

// After a deploy, stale tabs reload once instead of showing a blank page (shared with the /s/:token entry).
installChunkReload();

// Supabase sends an OAuth login back to the Site URL ("/") when the redirectTo URL isn't in the dashboard's
// Redirect URLs list (e.g. www.a4ai.in vs a4ai.in) — the user then sat on the landing page, signed in.
// Hand such a landing on to /auth/callback (exchanges ?code=, saves the role, goes to the dashboard).
{
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname === "/" && (params.has("code") || params.has("error_description"))) {
    window.history.replaceState(null, "", `/auth/callback${window.location.search}${window.location.hash}`);
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

