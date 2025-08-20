import { useRef, useState } from "react";
import { motion, useInView, useMotionValue, useTransform, useMotionTemplate } from "framer-motion";
import { Play } from "lucide-react";

type LandingDemoProps = {
  youtubeId?: string;
};

export default function LandingDemo({ youtubeId }: LandingDemoProps) {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-20% 0px" });

  // cursor + tilt
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [0, 300], [8, -8]);   // tilt up/down
  const rotateY = useTransform(mx, [0, 600], [-10, 10]); // tilt left/right
  const glowX = useTransform(mx, v => v);
  const glowY = useTransform(my, v => v);

  const [hintVisible, setHintVisible] = useState(true);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24"
      onMouseMove={onMouseMove}
    >
      {/* animated background blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-40 h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ opacity: inView ? 0.35 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1, 1.08, 1], rotate: [0, 10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,102,241,0.35), transparent 70%)",
          }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-40 h-[38rem] w-[38rem] rounded-full blur-3xl"
        style={{ opacity: inView ? 0.3 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1.05, 0.98, 1.05] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(168,85,247,0.32), transparent 70%)",
          }}
        />
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
        >
          See a4ai in Action
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mx-auto mt-4 max-w-2xl text-center text-gray-600 dark:text-gray-300"
        >
          Generate, host, and analyze assessments—end-to-end in minutes.
        </motion.p>

        {/* video card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative mx-auto mt-10 w-full max-w-5xl"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative aspect-video overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-black shadow-2xl"
            style={{ rotateX, rotateY }}
            onMouseLeave={() => {
              mx.set(300);
              my.set(150);
            }}
          >
            {/* shimmer glow that follows cursor */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: useMotionTemplate`
                  radial-gradient(200px 200px at ${glowX}px ${glowY}px,
                    rgba(255,255,255,0.12), transparent 70%)
                `,
              }}
            />

            {/* subtle gradient ring */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-transparent [background:linear-gradient(black,black)_padding-box,linear-gradient(90deg,rgba(99,102,241,.45),rgba(168,85,247,.45))_border-box] [border:1px_solid_transparent]"
            />

            {/* media */}
            {youtubeId ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                title="a4ai Demo Video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setHintVisible(false)}
              />
            ) : (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
                poster="/demo-poster.jpg"
                onPlay={() => setHintVisible(false)}
              >
                <source src="/demo.mp4" type="video/mp4" />
                <source src="/demo.webm" type="video/webm" />
              </video>
            )}

            {/* pulsing play hint (auto hides after play) */}
            {hintVisible && (
              <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="relative rounded-full bg-white/20 text-white backdrop-blur px-4 py-2 text-sm font-medium"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  <div className="absolute inset-0 -z-10 rounded-full">
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 60%)",
                      }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <Play className="h-4 w-4" />
                    Play demo
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
