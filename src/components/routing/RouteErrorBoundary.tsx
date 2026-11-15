// Catches a page that can't render, mostly a lazy page's file that can't download offline (lib/chunkReload.ts leaves
// that case alone). Without it React unmounts the whole app to a blank screen. It wraps only the routes, so the
// connection banner and toasts stay up. Nothing else is on screen by then, so it can reload when the internet returns.
import React from "react";

export default class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean; offline: boolean }> {
  state = { failed: false, offline: false };

  static getDerivedStateFromError() {
    return { failed: true, offline: !navigator.onLine };
  }

  componentDidCatch(err: unknown) {
    console.error("[a4ai] page crashed:", err);
    if (!navigator.onLine) window.addEventListener("online", this.reload, { once: true });
  }

  componentWillUnmount() {
    window.removeEventListener("online", this.reload);
  }

  reload = () => window.location.reload();

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-center dark:bg-gray-950">
        <div className="max-w-sm">
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {this.state.offline ? "This page needs the internet to open" : "This page could not be shown"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {this.state.offline ? "It will open by itself when you're back online." : "Reload the page to try again."}
          </p>
          <button onClick={this.reload} className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
