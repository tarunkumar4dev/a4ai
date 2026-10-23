// src/linkMain.tsx — entry of s.html: the student upload link (/s/:token) on its own, without the app shell
// (no router, auth providers, analytics, payment script or web fonts), so it starts fast on a cheap phone over
// slow 4G. Hosting rewrites /s/<token> to /s.html (vercel.json; vite.config.ts for dev / preview).
import React from "react";
import ReactDOM from "react-dom/client";
import AssignmentLinkPage from "./pages/AssignmentLinkPage";
import { installChunkReload } from "./lib/chunkReload";
import "./index.css";
import "./styles/lite.css";

installChunkReload();

const token = decodeURIComponent(window.location.pathname.replace(/^\/s\//, "").replace(/\/.*$/, ""));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AssignmentLinkPage token={token} />
  </React.StrictMode>,
);
