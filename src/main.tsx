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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
