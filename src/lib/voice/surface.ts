// "Start listening" requests from outside the dock (the floating mic on mobile dashboards opens the sheet, then asks
// the dock — which mounts a frame later — to begin). Main bundle, no deps.
import { useEffect, useState } from "react";

const listeners = new Set<() => void>();
let pending = false;

export function onVoiceStartRequest(fn: () => void): () => void {
  listeners.add(fn);
  if (pending) {
    pending = false;
    queueMicrotask(fn);
  }
  return () => {
    listeners.delete(fn);
  };
}

export function requestVoiceStart(): void {
  if (!listeners.size) {
    pending = true;
    setTimeout(() => {
      pending = false;
    }, 4000);
    return;
  }
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Voice status broadcasting (idle | listening | processing | speaking)
// ---------------------------------------------------------------------------
export type VoiceStatus = "idle" | "listening" | "processing" | "speaking";
let currentVoiceStatus: VoiceStatus = "idle";
const statusListeners = new Set<(status: VoiceStatus) => void>();

export function getVoiceStatus(): VoiceStatus {
  return currentVoiceStatus;
}

export function setVoiceStatus(status: VoiceStatus): void {
  if (currentVoiceStatus === status) return;
  currentVoiceStatus = status;
  statusListeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* noop */
    }
  });
}

export function onVoiceStatusChange(fn: (status: VoiceStatus) => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

export function useVoiceStatus(): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>(getVoiceStatus);
  useEffect(() => onVoiceStatusChange(setStatus), []);
  return status;
}

// ---------------------------------------------------------------------------
// Voice agent obstruction management (mobile drawer / modal open)
// When drawer opens, floating mic must hide cleanly and never overlap or collide
// ---------------------------------------------------------------------------
let obstructedCount = 0;
const obstructionListeners = new Set<(obstructed: boolean) => void>();

export function isVoiceAgentObstructed(): boolean {
  return obstructedCount > 0;
}

export function setVoiceAgentObstructed(obstructed: boolean): void {
  const wasObstructed = obstructedCount > 0;
  if (obstructed) {
    obstructedCount++;
  } else {
    obstructedCount = Math.max(0, obstructedCount - 1);
  }
  const isNowObstructed = obstructedCount > 0;
  if (wasObstructed !== isNowObstructed) {
    obstructionListeners.forEach((fn) => {
      try {
        fn(isNowObstructed);
      } catch {
        /* noop */
      }
    });
  }
}

export function onVoiceAgentObstructedChange(fn: (obstructed: boolean) => void): () => void {
  obstructionListeners.add(fn);
  return () => {
    obstructionListeners.delete(fn);
  };
}

export function useVoiceAgentObstructed(): boolean {
  const [obstructed, setObstructed] = useState<boolean>(isVoiceAgentObstructed);
  useEffect(() => onVoiceAgentObstructedChange(setObstructed), []);
  return obstructed;
}

/** Component-level hook to declare that the voice agent is obstructed (e.g. while sidebar drawer is open). */
export function useSetVoiceAgentObstructed(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    setVoiceAgentObstructed(true);
    return () => {
      setVoiceAgentObstructed(false);
    };
  }, [isOpen]);
}

/** Tests only. */
export const _resetVoiceSurface = () => {
  listeners.clear();
  statusListeners.clear();
  obstructionListeners.clear();
  pending = false;
  currentVoiceStatus = "idle";
  obstructedCount = 0;
};
