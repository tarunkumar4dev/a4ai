// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/lite.css"; // no animations / blur (Play Store WebView speed)

/* ---------- Vercel Analytics inject() ---------- */
import { inject } from "@vercel/analytics";

if (import.meta.env.PROD) {
  inject(); // ✅ enable only in production
}

// After a deploy, tabs still running the previous build request chunk files that no longer
// exist. Reload once so the browser picks up the new index.html instead of showing a blank page.
const CHUNK_RELOAD_KEY = "a4ai:chunk-reload";
window.addEventListener("vite:preloadError", (event) => {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return; // already retried in this tab; let the error surface
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    return; // storage unavailable: don't risk a reload loop
  }
  event.preventDefault();
  window.location.reload();
});

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

// The app started fine: allow one automatic reload again for the next deploy.
setTimeout(() => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* storage unavailable */
  }
}, 5000);
