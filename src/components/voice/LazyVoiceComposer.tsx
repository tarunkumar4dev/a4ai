// The message box with voice input. Until the voice chunk is in (and for signed-out users) it is the plain box.
// Its own file, imported only by the (lazy) chat panel, so the eager launcher never pulls the composer in.
import { Suspense, lazy, type ComponentProps } from "react";
import { AgentComposer } from "@/components/agent/AgentComposer";

const VoiceComposerChunk = lazy(() => import("./VoiceComposer"));

export function LazyVoiceComposer(props: ComponentProps<typeof AgentComposer>) {
  if (!props.uid) return <AgentComposer {...props} />;
  return <Suspense fallback={<AgentComposer {...props} />}><VoiceComposerChunk {...props} /></Suspense>;
}
