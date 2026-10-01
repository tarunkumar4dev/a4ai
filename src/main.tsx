// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

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
