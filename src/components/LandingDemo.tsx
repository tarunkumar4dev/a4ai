import { useRef, useState, useEffect } from "react";
import { motion, useInView, useMotionValue, useTransform, useMotionTemplate } from "framer-motion";
import { Play } from "lucide-react";

type LandingDemoProps = {
  youtubeId?: string;
};

export default function LandingDemo({ youtubeId }: LandingDemoProps) {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-20% 0px" });

  // cursor + tilt
  const mx = useMotionValue(300);
  const my = useMotionValue(150);
  const rotateX = useTransform(my, [0, 300], [5, -5]);   // reduced tilt range for subtlety
  const rotateY = useTransform(mx, [0, 600], [-7, 7]);   // reduced tilt range for subtlety
  const glowX = useTransform(mx, v => v);
  const glowY = useTransform(my, v => v);

  const [hintVisible, setHintVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  // Reset position when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24"
      onMouseMove={onMouseMove}
    >
      {/* animated background blobs - optimized with will-change */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-40 h-[42rem] w-[42rem] rounded-full blur-3xl will-change-transform"
        style={{ opacity: inView ? 0.35 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,102,241,0.35), transparent 70%)",
          }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-40 h-[38rem] w-[38rem] rounded-full blur-3xl will-change-transform"
        style={{ opacity: inView ? 0.3 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1.03, 0.97, 1.03] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
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
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600"
        >
          See a4ai in Action
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-4 max-w-2xl text-center text-gray-600 dark:text-gray-300 text-lg"
        >
          Generate, host, and analyze assessments—end-to-end in minutes.
        </motion.p>

        {/* video card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-12 w-full max-w-5xl"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative aspect-video overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-black shadow-2xl will-change-transform"
            style={{ rotateX, rotateY }}
            onMouseLeave={() => {
              mx.set(300);
              my.set(150);
            }}
          >
            {/* subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-transparent via-transparent to-black/20 z-10 pointer-events-none" />
            
            {/* shimmer glow that follows cursor */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
              style={{
                background: useMotionTemplate`
                  radial-gradient(300px 300px at ${glowX}px ${glowY}px,
                    rgba(255,255,255,0.15), transparent 70%)
                `,
                opacity: isLoaded ? 1 : 0
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
                onLoad={() => {
                  setHintVisible(false);
                  setIsLoaded(true);
                }}
              />
            ) : (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
                poster="/demo-poster.jpg"
                onPlay={() => setHintVisible(false)}
                onLoadedData={() => setIsLoaded(true)}
              >
                <source src="/demo.mp4" type="video/mp4" />
                <source src="/demo.webm" type="video/webm" />
              </video>
            )}

            {/* pulsing play hint (auto hides after play) */}
            {hintVisible && (
              <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="relative rounded-full bg-white/10 text-white backdrop-blur-lg px-5 py-2.5 text-sm font-medium border border-white/20"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  <div className="absolute inset-0 -z-10 rounded-full overflow-hidden">
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)",
                      }}
                      animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <Play className="h-4 w-4" fill="white" />
                    Play demo
                  </div>
                </motion.div>
              </motion.div>
            )}
            
            {/* loading state */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                <motion.div 
                  className="h-12 w-12 rounded-full border-2 border-transparent border-t-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}