// AccessProvider + RoleRoute: a failed get_my_access must never send a signed-in user to /login, and permissions
// are re-checked on TOKEN_REFRESHED / focus without re-rendering the app when nothing changed.
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let authCallback: ((event: string) => void) | null = null;
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: () => { authCallback = null; } } } };
      },
    },
  },
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "u1" } }, loading: false, role: null }),
}));

import { AccessProvider, useAccess, type AccessData } from "./AccessProvider";

const ACCESS_FOCUS_MIN_GAP_MS = 30_000; // same as AccessProvider
import { RoleRoute } from "@/components/routing/RoleRoute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const admin: AccessData = {
  institute_id: "i1", institute_name: "MSIT", primary_role: "admin", home_route: "/institute",
  hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [],
};
const ok = (a: AccessData) => ({ data: [a], error: null });
const netErr = { data: null, error: { message: "Failed to fetch" } };

const seen: unknown[] = [];
function Probe() {
  const { access } = useAccess();
  seen.push(access);
  return null;
}

let host: HTMLDivElement;
let root: Root;

function render(path = "/institute") {
  root = createRoot(host);
  act(() => {
    root.render(
      React.createElement(AccessProvider, null,
        React.createElement(Probe),
        React.createElement(MemoryRouter, { initialEntries: [path] },
          React.createElement(Routes, null,
            React.createElement(Route, {
              path: "/institute",
              element: React.createElement(RoleRoute, { allow: ["admin"], children: React.createElement("p", null, "DASH") }),
            }),
            React.createElement(Route, { path: "/dashboard", element: React.createElement("p", null, "TEACHER-HOME") }),
            React.createElement(Route, { path: "/login", element: React.createElement("p", null, "LOGIN") }),
          ),
        ),
      ),
    );
  });
}
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const text = () => host.textContent || "";

beforeEach(() => {
  vi.useFakeTimers();
  rpc.mockReset();
  seen.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("AccessProvider", () => {
  it("retries a network error and then shows the page", async () => {
    rpc.mockResolvedValueOnce(netErr).mockResolvedValueOnce(netErr).mockResolvedValueOnce(ok(admin));
    render();
    await flush();
    expect(text()).toContain("Loading");
    await flush(1000);
    await flush(3000);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(text()).toContain("DASH");
  });

  it("when every attempt fails: Retry screen, never /login; Retry recovers", async () => {
    rpc.mockResolvedValue(netErr);
    render();
    await flush();
    await flush(1000);
    await flush(3000);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(text()).toContain("We couldn't check your access");
    expect(text()).not.toContain("LOGIN");

    rpc.mockResolvedValue(ok(admin));
    const btn = [...host.querySelectorAll("button")].find(b => b.textContent === "Retry")!;
    act(() => btn.click());
    await flush();
    expect(text()).toContain("DASH");
  });

  it("TOKEN_REFRESHED re-checks; unchanged access keeps the same object (no app re-render)", async () => {
    rpc.mockResolvedValue(ok(admin));
    render();
    await flush();
    const first = seen[seen.length - 1];
    expect(first).toMatchObject({ primary_role: "admin" });
    const renders = seen.length;

    rpc.mockResolvedValue(ok({ ...admin })); // equal content, new object
    act(() => authCallback?.("TOKEN_REFRESHED"));
    await flush();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(seen.length).toBe(renders); // context value unchanged → Probe did not re-render
    expect(seen[seen.length - 1]).toBe(first);
  });

  it("a role removed while the page is open takes effect on the next check", async () => {
    rpc.mockResolvedValue(ok(admin));
    render();
    await flush();
    expect(text()).toContain("DASH");

    rpc.mockResolvedValue(ok({ ...admin, primary_role: "teacher", home_route: "/dashboard" }));
    act(() => authCallback?.("TOKEN_REFRESHED"));
    await flush();
    expect(text()).toContain("TEACHER-HOME");
  });

  it("a failed re-check keeps the known access (no lock-out, no error screen)", async () => {
    rpc.mockResolvedValue(ok(admin));
    render();
    await flush();
    rpc.mockResolvedValue(netErr);
    act(() => authCallback?.("TOKEN_REFRESHED"));
    await flush();
    await flush(1000);
    await flush(3000);
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(text()).toContain("DASH");
  });

  it("focus re-checks at most once per 30 s, and not while hidden", async () => {
    rpc.mockResolvedValue(ok(admin));
    render();
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1);

    act(() => { window.dispatchEvent(new Event("focus")); });
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1); // too soon

    await flush(ACCESS_FOCUS_MIN_GAP_MS);
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => { window.dispatchEvent(new Event("focus")); });
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1); // hidden tab
    vis.mockRestore();

    act(() => { window.dispatchEvent(new Event("focus")); });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); }); // fires together with focus
    await flush();
    expect(rpc).toHaveBeenCalledTimes(2); // one request for both events
  });
});
