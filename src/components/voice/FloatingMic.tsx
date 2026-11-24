// src/components/voice/FloatingMic.tsx
// Zomato-inspired floating AI voice agent button for a4ai.
// Features:
// - Jewel purple gradient (#D8B4FE -> #8B35E8 -> #581C87) with a subtle warm-gold halo behind it
// - 68px circular button, docked at the bottom navigation center overlapping the bar like Zomato
// - Long-press (380ms) to pick up and drag; a plain tap always opens the agent sheet
// - Magnetic snapping to the nearest screen edge or back to the bottom dock on release
// - Audio-reactive animation rings and state indicators (idle, listening, processing, speaking)
// - Architectural obstruction hiding: smoothly vanishes when the mobile sidebar / drawer opens
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, Loader2 } from "lucide-react";
import { useVoiceConfig } from "@/lib/voice/useVoiceConfig";
import { recordingSupported } from "@/lib/voice/ptt";
import {
  requestVoiceStart,
  useVoiceAgentObstructed,
  useVoiceStatus,
  type VoiceStatus,
} from "@/lib/voice/surface";

interface FloatingMicProps {
  uid: string | null;
  onOpen: () => void;
}

const BUTTON_SIZE = 68; // px
// A short, deliberate press before the mic can be dragged. A tap never moves it; a scroll never
// moves it; only a hold. Matches the Zomato / Material "pick up" gesture.
const LONG_PRESS_MS = 380;
// If the finger moves more than this before the long-press timer fires, cancel the pick-up and
// let the browser treat the gesture as a scroll instead.
const PRE_HOLD_SLOP = 10;
const SAFE_MARGIN_X = 14;
const SAFE_TOP = 64; // below mobile sticky header
// Space the docked mic reserves at the bottom of the viewport. Institute + HOD have a 5-slot
// bottom nav (~56px tall + safe-area); the mic sits visually on top of it as a Zomato-style notch.
// Teacher dashboard has no bottom nav → the mic just floats a bit higher than before.
const DOCK_BOTTOM_PX = 32;

export default function FloatingMic({ uid, onOpen }: FloatingMicProps) {
  const canRecord = recordingSupported();
  const config = useVoiceConfig(canRecord ? uid : null);
  const isObstructed = useVoiceAgentObstructed();
  const voiceStatus: VoiceStatus = useVoiceStatus();

  // Position coordinates: null means default docked position at bottom center
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const startPointerRef = useRef<{ x: number; y: number } | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const holdArmedRef = useRef(false); // true after the long-press timer fires = pickup engaged
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [heldDown, setHeldDown] = useState(false); // drives the pre-pickup "swell" animation

  // Clamp any (x, y) to safe viewport bounds. The bottom bound reserves room for the mobile
  // bottom nav on Institute/HOD so a dragged mic never gets dropped under it.
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const maxX = window.innerWidth - BUTTON_SIZE - SAFE_MARGIN_X;
    const minX = SAFE_MARGIN_X;
    const maxY = window.innerHeight - BUTTON_SIZE - DOCK_BOTTOM_PX;
    const minY = SAFE_TOP;
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
    };
  }, []);

  // Keep button inside screen on resize / orientation change
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        if (!prev) return null;
        return clampPosition(prev.x, prev.y);
      });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [clampPosition]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== undefined) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
  };

  // Pointer Down: start the long-press timer. Dragging only engages once the timer fires —
  // a plain tap (release before LONG_PRESS_MS) always opens the sheet.
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // primary button only
    let current = pos;
    if (!current && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      current = { x: rect.left, y: rect.top };
    }
    const safeCurrent = current || {
      x: Math.round((window.innerWidth - BUTTON_SIZE) / 2),
      y: Math.round(window.innerHeight - BUTTON_SIZE - DOCK_BOTTOM_PX),
    };
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...safeCurrent };
    hasDraggedRef.current = false;
    holdArmedRef.current = false;
    setHeldDown(true);
    clearHoldTimer();
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    holdTimerRef.current = setTimeout(() => {
      if (!startPointerRef.current) return;
      holdArmedRef.current = true;
      // Capture only once the gesture has committed to drag — a tap never captures the pointer,
      // so taps don't block scrolling or get swallowed by iOS's touch delays.
      try { target.setPointerCapture(pointerId); } catch { /* noop */ }
      try { navigator.vibrate?.(10); } catch { /* noop */ }
    }, LONG_PRESS_MS);
  };

  // Pointer Move: before pickup, cancel on any real movement (= it's a scroll, not a drag).
  // After pickup, follow the finger.
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPointerRef.current) return;
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;

    if (!holdArmedRef.current) {
      // Still waiting for the long press to fire. If the finger moves, the user is scrolling —
      // bail out of the pickup attempt entirely.
      if (Math.hypot(dx, dy) > PRE_HOLD_SLOP) {
        clearHoldTimer();
        startPointerRef.current = null;
        setHeldDown(false);
      }
      return;
    }

    if (!hasDraggedRef.current) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }

    const targetX = startPosRef.current.x + dx;
    const targetY = startPosRef.current.y + dy;
    setPos(clampPosition(targetX, targetY));
  };

  // Pointer Up / Cancel: snap to nearest edge or bottom dock; a release before the long-press
  // timer fires is treated as a tap and opens the sheet.
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const wasTracking = !!startPointerRef.current;
    const wasDragging = hasDraggedRef.current;
    const wasArmed = holdArmedRef.current;

    clearHoldTimer();
    setHeldDown(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch { /* noop */ }

    startPointerRef.current = null;
    hasDraggedRef.current = false;
    holdArmedRef.current = false;
    setIsDragging(false);

    if (!wasTracking) return;

    if (wasDragging && pos) {
      // Snapping: dropped in the bottom 160px AND near horizontal centre → back to the dock,
      // else snap to the nearest side edge.
      const centerX = (window.innerWidth - BUTTON_SIZE) / 2;
      const distFromCenter = Math.abs(pos.x - centerX);
      const isNearBottom = pos.y > window.innerHeight - 160;
      if (isNearBottom && distFromCenter < 90) {
        setPos(null);
      } else {
        const snapLeft = SAFE_MARGIN_X;
        const snapRight = window.innerWidth - BUTTON_SIZE - SAFE_MARGIN_X;
        const snappedX = pos.x < window.innerWidth / 2 ? snapLeft : snapRight;
        setPos(clampPosition(snappedX, pos.y));
      }
      return;
    }

    // Not dragged. If the long-press pickup had already armed, the user picked it up and let go
    // in place — don't open the sheet. Otherwise this was a tap → open the sheet.
    if (wasArmed) return;
    onOpen();
    if (canRecord && config?.enabled !== false) {
      requestVoiceStart();
    }
  };

  // Tidy up the timer if the component unmounts mid-press.
  useEffect(() => clearHoldTimer, []);

  const isListening = voiceStatus === "listening";
  const isProcessing = voiceStatus === "processing";
  const isSpeaking = voiceStatus === "speaking";

  return (
    <div
      className={`fixed z-[105] select-none transition-opacity duration-200 ease-out sm:hidden ${
        isObstructed ? "pointer-events-none opacity-0 scale-90" : "opacity-100 scale-100"
      }`}
      style={
        pos
          ? {
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              width: `${BUTTON_SIZE}px`,
              height: `${BUTTON_SIZE}px`,
              transition: isDragging
                ? "transform 0.1s ease-out, opacity 0.2s ease-out"
                : "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }
          : {
              // Zomato-style notch: the mic sits on top of the mobile bottom nav (Institute + HOD)
              // without colliding with its center slot. On Teacher dashboard (no bottom nav) it
              // simply floats slightly higher than before.
              bottom: `calc(${DOCK_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
              left: "50%",
              transform: "translateX(-50%)",
              width: `${BUTTON_SIZE}px`,
              height: `${BUTTON_SIZE}px`,
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }
      }
      aria-hidden={isObstructed}
    >
      {/* Outer audio-reactive ripple rings when listening */}
      {isListening && (
        <>
          <span
            className="absolute inset-0 rounded-full bg-purple-500/30 anim-agent-ripple pointer-events-none"
            style={{ animationDelay: "0s" }}
          />
          <span
            className="absolute inset-0 rounded-full bg-purple-400/20 anim-agent-ripple pointer-events-none"
            style={{ animationDelay: "0.75s" }}
          />
        </>
      )}

      {/* Warm gold halo behind the mic — the soft, premium glow the designer asked for.
          Sits behind everything (-z-10), scaled slightly larger than the button, very low opacity.
          Not animated; it's a static ambient wash, not an "AI-generated" shimmer. */}
      {!isObstructed && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none -z-10"
          aria-hidden="true"
          style={{
            transform: "scale(1.35)",
            background:
              "radial-gradient(circle at 50% 55%, rgba(253, 224, 71, 0.38) 0%, rgba(251, 191, 36, 0.18) 45%, rgba(251, 191, 36, 0) 72%)",
            filter: "blur(2px)",
          }}
        />
      )}

      {/* Ambient purple breathing glow when idle (subtle, behind the gold halo) */}
      {!isListening && !isObstructed && (
        <span className="absolute inset-0 rounded-full bg-purple-600/20 anim-agent-glow pointer-events-none -z-10" />
      )}

      {/* Main Zomato-inspired Jewel Circular Button */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="floating-mic"
        aria-label="Ask a4ai (AI Voice Agent)"
        title="Bol kar poochhiye"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`group relative flex h-full w-full items-center justify-center rounded-full text-white cursor-pointer touch-none active:scale-95 ${
          isDragging ? "scale-110 shadow-2xl cursor-grabbing" : heldDown ? "scale-[1.04]" : ""
        }`}
        style={{
          background: isListening
            ? "radial-gradient(circle at 35% 30%, #FF8A80 0%, #E53935 60%, #B71C1C 100%)"
            : "radial-gradient(circle at 32% 28%, #D8B4FE 0%, #8B35E8 52%, #581C87 100%)",
          boxShadow: isListening
            ? "0 0 0 3px rgba(255,255,255,0.4), 0 14px 32px -4px rgba(229, 57, 53, 0.6)"
            : "0 0 0 2px rgba(255,255,255,0.35), 0 14px 30px -4px rgba(139, 53, 232, 0.55), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.25)",
        }}
      >
        {/* Subtle glass reflection highlight on upper curve */}
        <span
          className="absolute top-1.5 inset-x-3 h-5 rounded-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none"
          aria-hidden="true"
        />

        {/* Center icon / status animation */}
        <div className="relative z-10 flex items-center justify-center">
          {isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin text-white drop-shadow" />
          ) : isSpeaking ? (
            <Volume2 className="h-7 w-7 text-white animate-pulse drop-shadow" />
          ) : isListening ? (
            <div className="flex items-center gap-1">
              <span className="h-5 w-1 rounded-full bg-white anim-agent-wave" />
              <span className="h-7 w-1.5 rounded-full bg-white anim-agent-wave" style={{ animationDelay: "0.2s" }} />
              <span className="h-4 w-1 rounded-full bg-white anim-agent-wave" style={{ animationDelay: "0.4s" }} />
            </div>
          ) : (
            <Mic className="h-7 w-7 text-white drop-shadow-md transition-transform duration-200 group-hover:scale-110" />
          )}
        </div>

      </button>
    </div>
  );
}
