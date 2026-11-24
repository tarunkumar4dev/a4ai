// src/components/voice/FloatingMic.tsx
// Zomato-inspired floating AI voice agent button for a4ai.
// Features:
// - Zomato purple-to-lavender jewel gradient (#D8B4FE -> #8B35E8 -> #581C87)
// - 68px circular button with subtle outer glow and translucent border
// - Docked at the bottom navigation center overlapping the bar like Zomato
// - Full pointer/touch drag interaction with 6px threshold to prevent accidental drags
// - Magnetic snapping to nearest screen edge or bottom dock on release
// - Audio-reactive animation rings and state indicators (idle, listening, processing, speaking)
// - Architectural obstruction hiding: smoothly vanishes when mobile sidebar/drawer opens (Phase 2)
// - Always visible on mobile dashboards; tapping opens the agent sheet and activates voice if supported
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, Sparkles, Loader2 } from "lucide-react";
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
const DRAG_THRESHOLD = 6; // px to distinguish tap vs drag
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
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  // Pointer Down: Start tracking drag
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
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Pointer Move: Update position if threshold passed
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPointerRef.current) return;
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;

    if (!hasDraggedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }

    if (hasDraggedRef.current) {
      const targetX = startPosRef.current.x + dx;
      const targetY = startPosRef.current.y + dy;
      setPos(clampPosition(targetX, targetY));
    }
  };

  // Pointer Up / Cancel: Snap to nearest edge or bottom dock
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPointerRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* noop */
    }

    if (hasDraggedRef.current && pos) {
      // Snapping logic:
      // If dropped in the bottom 160px and near center horizontal (within 90px of center), snap to default dock
      const centerX = (window.innerWidth - BUTTON_SIZE) / 2;
      const distFromCenter = Math.abs(pos.x - centerX);
      const isNearBottom = pos.y > window.innerHeight - 160;

      if (isNearBottom && distFromCenter < 90) {
        setPos(null); // snaps back to bottom dock center
      } else {
        // Snap to nearest screen edge (left or right)
        const snapLeft = SAFE_MARGIN_X;
        const snapRight = window.innerWidth - BUTTON_SIZE - SAFE_MARGIN_X;
        const snappedX = pos.x < window.innerWidth / 2 ? snapLeft : snapRight;
        setPos(clampPosition(snappedX, pos.y));
      }
    } else {
      // It was a tap/click! Trigger open sheet and start voice if enabled
      onOpen();
      if (canRecord && config?.enabled !== false) {
        requestVoiceStart();
      }
    }

    startPointerRef.current = null;
    hasDraggedRef.current = false;
    setIsDragging(false);
  };

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

      {/* Ambient breathing glow when idle */}
      {!isListening && !isObstructed && (
        <span className="absolute inset-0 rounded-full bg-purple-600/25 anim-agent-glow pointer-events-none -z-10" />
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
          isDragging ? "scale-105 shadow-2xl cursor-grabbing" : ""
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

        {/* Mini AI sparkle badge indicator on top right */}
        <span
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-[#581C87] shadow-sm border border-white/60 pointer-events-none"
          aria-hidden="true"
        >
          <Sparkles className="h-3 w-3 fill-current" />
        </span>
      </button>
    </div>
  );
}
