// AuthCharacters.tsx — the characters beside the login / signup forms.
import { useEffect, useRef, type ReactNode } from "react";

// Six characters whose eyes follow the pointer. Pointer moves never re-render
// React: one requestAnimationFrame per pointermove (no running loop) writes the
// transforms straight to the SVG nodes. Tracking is off on touch-only devices,
// with reduced motion or Data Saver, and while the tab is hidden. On a wrong
// password every face shakes "no" (.a4-no, src/index.css; skipped under reduced motion).

interface Face {
  body: ReactNode;
  cx: number; // face centre (viewBox units)
  cy: number;
  max: number; // how far the face leans towards the pointer
  eyes: { x: number; y: number; r: number; pr: number; light?: boolean }[];
  mouth: ReactNode;
}

const INK = "#0F0F12";
const FACES: Face[] = [
  {
    body: <path d="M60 300 A110 110 0 0 1 280 300 L60 300 Z" fill="#FF7A2B" />,
    cx: 170, cy: 270, max: 5,
    eyes: [{ x: 155, y: 270, r: 7, pr: 3.5 }, { x: 185, y: 270, r: 7, pr: 3.5 }],
    mouth: <path d="M150 282 Q170 294 190 282" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />,
  },
  {
    body: <rect x="190" y="110" width="95" height="140" rx="18" fill="#7B48FF" />,
    cx: 240, cy: 145, max: 5,
    eyes: [{ x: 225, y: 145, r: 6.5, pr: 3.5 }, { x: 255, y: 145, r: 6.5, pr: 3.5 }],
    mouth: <path d="M225 160 Q240 168 255 160" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />,
  },
  {
    body: <rect x="280" y="200" width="75" height="90" rx="15" fill={INK} />,
    cx: 315, cy: 240, max: 3,
    eyes: [{ x: 300, y: 240, r: 7.5, pr: 3.5, light: true }, { x: 330, y: 240, r: 7.5, pr: 3.5, light: true }],
    mouth: <line x1="300" y1="255" x2="330" y2="255" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />,
  },
  {
    body: <path d="M320 80 L390 140 L250 140 Z" fill="#4ECDC4" />,
    cx: 320, cy: 120, max: 5,
    eyes: [{ x: 310, y: 120, r: 5, pr: 2 }, { x: 335, y: 120, r: 5, pr: 2 }],
    mouth: <path d="M315 130 L323 135 L331 130" stroke={INK} strokeWidth="2" fill="none" />,
  },
  {
    body: <rect x="350" y="180" width="95" height="110" rx="28" fill="#F2C500" />,
    cx: 400, cy: 220, max: 5,
    eyes: [{ x: 385, y: 225, r: 7, pr: 3.5 }, { x: 415, y: 225, r: 7, pr: 3.5 }],
    mouth: <path d="M385 240 q14 10 28 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />,
  },
  {
    body: <circle cx="120" cy="110" r="28" fill="#FF6B6B" />,
    cx: 120, cy: 110, max: 5,
    eyes: [{ x: 110, y: 105, r: 5, pr: 2 }, { x: 130, y: 105, r: 5, pr: 2 }],
    mouth: <path d="M115 112 a5 5 0 0 0 10 0" fill={INK} />,
  },
];

function trackingAllowed() {
  const mq = (q: string) => window.matchMedia?.(q).matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return !mq("(prefers-reduced-motion: reduce)") && !mq("(hover: none)") && !saveData;
}

export default function AuthCharacters({ shakeSignal = 0 }: { shakeSignal?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !trackingAllowed()) return;
    const faces = Array.from(svg.querySelectorAll<SVGGElement>("[data-face]"));
    const pupils = Array.from(svg.querySelectorAll<SVGGElement>("[data-pupil]"));
    let frame = 0;
    let px = 0;
    let py = 0;
    const toward = (bx: number, by: number, max: number, rect: DOMRect) => {
      const dx = px - (rect.left + (bx * rect.width) / 460);
      const dy = py - (rect.top + (by * rect.height) / 330);
      const d = Math.hypot(dx, dy) || 1;
      return `translate(${((dx / d) * max).toFixed(2)} ${((dy / d) * max).toFixed(2)})`;
    };
    const paint = () => {
      frame = 0;
      const rect = svg.getBoundingClientRect();
      for (const g of faces) g.setAttribute("transform", toward(+g.dataset.cx!, +g.dataset.cy!, +g.dataset.max!, rect));
      for (const g of pupils) g.setAttribute("transform", toward(+g.dataset.x!, +g.dataset.y!, 3, rect));
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || document.visibilityState !== "visible") return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Wrong password: one class on the <svg> for the length of the shake.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || shakeSignal === 0) return;
    svg.classList.remove("a4-no");
    void svg.getBoundingClientRect(); // restart the animation on a repeat failure
    svg.classList.add("a4-no");
    const t = window.setTimeout(() => svg.classList.remove("a4-no"), 400);
    return () => window.clearTimeout(t);
  }, [shakeSignal]);

  return (
    <svg ref={svgRef} viewBox="0 0 460 330" className="w-full h-full select-none" aria-hidden="true">
      <ellipse cx="230" cy="305" rx="170" ry="10" fill="#cbd5e1" opacity="0.6" />
      {FACES.map((f, i) => (
        <g key={i}>
          {f.body}
          <g className="a4-face">
            <g data-face="" data-cx={f.cx} data-cy={f.cy} data-max={f.max}>
              {f.eyes.map((e) => (
                <g key={e.x}>
                  <circle cx={e.x} cy={e.y} r={e.r} fill={e.light ? "#FFF" : INK} />
                  <g data-pupil="" data-x={e.x} data-y={e.y}>
                    <circle cx={e.x} cy={e.y} r={e.pr} fill={e.light ? INK : "#FFF"} />
                  </g>
                </g>
              ))}
              {f.mouth}
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}
