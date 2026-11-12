// Lazy entry points: the voice code (recorder, player, dock, settings) is a separate chunk that only downloads when
// the chat panel mounts for a signed-in staff user; the floating mic chunk only on mobile dashboards.
import { Suspense, lazy, type ComponentProps } from "react";
import type VoiceDockT from "./VoiceDock";
import type FloatingMicT from "./FloatingMic";

const Dock = lazy(() => import("./VoiceDock"));
const Floating = lazy(() => import("./FloatingMic"));

export function LazyVoiceDock(props: ComponentProps<typeof VoiceDockT>) {
  return <Suspense fallback={null}><Dock {...props} /></Suspense>;
}
export function LazyFloatingMic(props: ComponentProps<typeof FloatingMicT>) {
  return <Suspense fallback={null}><Floating {...props} /></Suspense>;
}
