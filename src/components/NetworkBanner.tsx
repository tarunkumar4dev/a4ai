// Small pill at the top of every page: red while offline, yellow while slow, green for a moment when the
// connection comes back. Mounted once in App.tsx and in linkMain.tsx (student upload link).
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

type Kind = "offline" | "slow" | "back" | "faster";

const BACK_VISIBLE_MS = 2500;

const CONTENT: Record<Kind, { text: string; bg: string; fg: string }> = {
  offline: { text: "No internet connection", bg: "#dc2626", fg: "#ffffff" },
  slow: { text: "Slow internet connection", bg: "#facc15", fg: "#422006" },
  back: { text: "Back online", bg: "#16a34a", fg: "#ffffff" },
  faster: { text: "Internet speed is back to normal", bg: "#16a34a", fg: "#ffffff" },
};

export default function NetworkBanner() {
  const quality = useNetworkStatus();
  const [shown, setShown] = useState<Kind | null>(null);
  // keeps the last message on screen while the pill slides away
  const [kind, setKind] = useState<Kind>("offline");
  const prev = useRef(quality);
  const slowDismissed = useRef(false);

  useEffect(() => {
    const was = prev.current;
    prev.current = quality;
    if (quality !== "slow") slowDismissed.current = false;

    if (quality === "offline" || (quality === "slow" && !slowDismissed.current)) {
      setKind(quality);
      setShown(quality);
      return;
    }
    if (quality === "slow") return;
    if (was === "online") return; // first render, nothing to recover from
    const recovered: Kind = was === "offline" ? "back" : "faster";
    setKind(recovered);
    setShown(recovered);
    const t = setTimeout(() => setShown(null), BACK_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [quality]);

  const { text, bg, fg } = CONTENT[kind];
  const visible = shown !== null;

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {visible ? text : ""}
      </div>
      <div
        className="a4-net-banner"
        data-visible={visible}
        aria-hidden={!visible}
        style={{ background: bg, color: fg }}
      >
        <span className="a4-net-dot" style={{ background: fg }} />
        <span>{text}</span>
        {kind === "slow" && (
          <button
            type="button"
            tabIndex={visible ? 0 : -1}
            aria-label="Dismiss"
            className="a4-net-close"
            onClick={() => {
              slowDismissed.current = true;
              setShown(null);
            }}
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
