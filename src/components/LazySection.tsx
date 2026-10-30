// src/components/LazySection.tsx — Suspense + error boundary for a lazy-loaded part of a page.
// A chunk that fails after a deploy is reloaded once by src/lib/chunkReload.ts; anything else lands here.
import React, { Suspense } from "react";

class SectionErrorBoundary extends React.Component<{ children: React.ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(`[a4ai] ${this.props.label} crashed:`, err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold text-slate-900">{this.props.label} could not be shown.</p>
        <p className="mt-1 text-sm text-slate-500">Reload the page to try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}

/** Fixed-height placeholder (no layout jump when the real content arrives); announced once to screen readers. */
export function SectionSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="rounded-2xl bg-white p-4 sm:p-6 border border-slate-100">
      <span className="sr-only">Loading {label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-10 mb-3 last:mb-0 rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export function LazySection({ label, fallback, children }: { label: string; fallback?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SectionErrorBoundary label={label}>
      <Suspense fallback={fallback ?? <SectionSkeleton label={label} />}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}
