// components/OptimizedDemo.jsx
// Clean demo section — no buttons, no search bar, no chat overlay.
// Video auto-plays when scrolled into view, pauses when scrolled away.
// Container ka aspect ratio video se hi derive hota hai => kabhi black bars nahi.

import React, { useState, useRef, useEffect } from 'react';

const OptimizedDemo = () => {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(16 / 9); // fallback jab tak metadata na aaye

  /* ── Scroll-triggered autoplay ── */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        const v = videoRef.current;
        if (!v) return;

        if (entry.isIntersecting) {
          v.muted = true; // mobile autoplay policy ke liye zaroori
          const p = v.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              /* browser ne autoplay block kiya — crash nahi hoga */
            });
          }
        } else {
          v.pause();
        }
      },
      { threshold: 0.25 }
    );

    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  /* ── Video ka real ratio pakdo ── */
  const handleMeta = (e) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      setRatio(v.videoWidth / v.videoHeight);
    }
  };

  return (
    <section className="py-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          ref={wrapRef}
          className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-3 sm:p-6 shadow-2xl ring-1 ring-slate-200/70"
        >
          {/* aspectRatio video se aata hai => letterbox bars zero */}
          <div
            className="relative w-full overflow-hidden rounded-xl bg-white"
            style={{ aspectRatio: ratio }}
          >
            <video
              ref={videoRef}
              poster="/demo-poster.png"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback"
              onLoadedMetadata={handleMeta}
              onLoadedData={() => setReady(true)}
              className="absolute inset-0 h-full w-full select-none object-cover"
              style={{ pointerEvents: 'none' }}
            >
              <source src="/demo.mp4" type="video/mp4" />
            </video>

            {/* Light skeleton jab tak first frame decode na ho */}
            {!ready && (
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-slate-100" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OptimizedDemo;