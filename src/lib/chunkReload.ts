// src/lib/chunkReload.ts — after a deploy, tabs still running the previous build request chunk files that no longer
// exist. Reload once so the browser picks up the new HTML instead of showing a blank page. Used by both entries
// (src/main.tsx and src/linkMain.tsx).
// A chunk also fails when there is simply no internet. Reloading then would swap the app (and any unsaved marks) for
// the browser's offline error page, so it reloads only if the site answers. Otherwise RouteErrorBoundary takes over.

import { isContestActive } from "./contestGuard";
import { probe } from "./networkStatus";

const CHUNK_RELOAD_KEY = "a4ai:chunk-reload";

export function installChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (isContestActive()) return; // never reload during a contest attempt; the attempt page has everything it needs
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return; // already retried in this tab; let the error surface
    } catch {
      return; // storage unavailable: don't risk a reload loop
    }
    event.preventDefault();
    probe(5000).then((ms) => {
      if (ms === null) return;
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return; // another failed chunk got here first
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      } catch {
        return;
      }
      window.location.reload();
    });
  });
  // The app started fine: allow one automatic reload again for the next deploy.
  setTimeout(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* storage unavailable */
    }
  }, 5000);
}
