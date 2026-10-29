// src/components/student/UploadSkeleton.tsx — placeholder for the upload screen (same blocks and heights, no layout
// shift). Its own file so the link page can show it without loading UploadAttempts.
import type { UploadTokens } from "./UploadAttempts";
/** First paint while the link loads: same blocks and heights as the real screen (no layout shift). */
export default function UploadSkeleton({ t }: { t: UploadTokens }) {
  const bar = (w: string, h: number) => <div className="rounded animate-pulse" style={{ width: w, height: h, background: t.border }} />;
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading" data-testid="upload-skeleton">
      <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: t.border }}>{bar("90%", 14)}{bar("70%", 14)}</div>
      <div className="grid grid-cols-2 gap-2">{bar("100%", 46)}{bar("100%", 46)}</div>
      {bar("100%", 46)}
      <div className="space-y-2">{bar("40%", 14)}{bar("100%", 64)}</div>
    </div>
  );
}
