// /src/components/GenerationRoom.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";

/* ----------------------------- Types ----------------------------- */
type GenerationRoomProps = {
  open: boolean;
  subject?: string;
  board?: string;
  grade?: string;
  difficulty?: string;
  elapsedSec: number;
  progress: number; // 0–100
  estSavedMinutes: number; // computed outside
};

const steps = [
  "Analysing blueprint & structure...",
  "Querying knowledge core (NCERT)...",
  "Selecting and refining questions...",
  "Generating multi-format documents...",
  "Final quality assurance checks...",
];

/* ------------------------- Helper Components ------------------------- */

// Tech Mini Info Card
const TechInfoCard = ({ label, value, colorClass }: { label: string; value: string; colorClass: string }) => (
  <motion.div
    className="rounded-xl border border-white/10 bg-black/70 px-4 py-2.5 shadow-lg backdrop-blur-md"
    whileHover={{ y: -3, scale: 1.05 }}
    transition={{ type: "spring", stiffness: 120, damping: 10 }}
  >
    <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500">{label}</div>
    <div className={`text-sm font-extrabold ${colorClass}`}>{value}</div>
  </motion.div>
);

// Animated Checkmark SVG
const AnimatedCheck = () => (
    <motion.svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-green-400"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "tween", ease: "easeOut" }}
    >
        <path
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </motion.svg>
);


/* ---------------------- Generation Room Main Component ---------------------- */

const GenerationRoom = ({
  open,
  subject,
  board,
  grade,
  difficulty,
  elapsedSec,
  progress,
  estSavedMinutes,
}: GenerationRoomProps) => {
  const stepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length + 0.0001));

  const cardVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 200, damping: 20 } },
    exit: { scale: 1.05, opacity: 0, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="gen-room-v2"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal
          role="dialog"
        >
          {/* Backdrop: Dark Blue/Purple Gradient */}
          <motion.div
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Subtle Star/Grid effect */}
          <div className="fixed inset-0 opacity-10 [background-image:radial-gradient(#1e40af_1px,transparent_1px),radial-gradient(#8b5cf6_1px,transparent_1px)] [background-size:64px_64px] [background-position:0_0,32px_32px]" />

          {/* Rotating gradient ring (Tech Aura) */}
          <motion.div
            className="absolute h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-sky-400/30 via-fuchsia-500/30 to-black/0 blur-3xl opacity-50"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />

          {/* Card: Hard Edges, Dark Tech Aesthetic */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-[680px] rounded-xl border-2 border-indigo-500/50 bg-black shadow-[0_20px_60px_rgba(40,20,80,0.8)] text-white overflow-hidden"
          >
            {/* Top Glow Bar */}
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-sky-400 to-fuchsia-500 blur-sm" />
            
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-indigo-500/30 pb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-700 text-white shadow-xl shadow-indigo-500/30">
                  <Sparkles className="h-5 w-5 fill-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-fuchsia-400">
                    A4AI: Hyper-Generation Mode
                  </h3>
                  <p className="text-slate-400 text-sm font-medium">
                    Compiling test matrix... High velocity synthesis in progress.
                  </p>
                </div>
                <motion.div 
                    className="ml-auto text-sm tabular-nums text-fuchsia-400 font-bold tracking-wider"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                >
                  {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
                </motion.div>
              </div>

              {/* Floating Tech Cards */}
              <div className="mt-6 relative h-[80px] sm:h-[100px] flex items-center justify-center gap-6">
                <motion.div
                  initial={{ y: 20, opacity: 0, x: -10 }}
                  animate={{ y: 0, opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <TechInfoCard label="Subject" value={subject || "—"} colorClass="text-sky-400" />
                </motion.div>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <TechInfoCard label="Class/Board" value={`${grade || "—"} / ${board || "—"}`} colorClass="text-green-400" />
                </motion.div>
                <motion.div
                  initial={{ y: 20, opacity: 0, x: 10 }}
                  animate={{ y: 0, opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <TechInfoCard label="Difficulty" value={difficulty || "—"} colorClass="text-fuchsia-400" />
                </motion.div>
              </div>

              {/* Steps (Dynamic Indicators) */}
              <div className="mt-4 space-y-2">
                {steps.map((s, i) => {
                  const active = i === stepIndex;
                  const done = i < stepIndex;
                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-300 ${
                        active ? "border-fuchsia-500/60 bg-indigo-900/40 shadow-lg shadow-fuchsia-500/20" : 
                        done ? "border-green-600/30 bg-black/50" : 
                        "border-slate-800 bg-black/70"
                      }`}
                    >
                      <div className="h-5 w-5 flex items-center justify-center">
                        {done ? (
                          <AnimatedCheck /> // Animated Checkmark
                        ) : active ? (
                            <motion.div
                                className="h-4 w-4 rounded-full bg-fuchsia-400 shadow-xl shadow-fuchsia-500/50"
                                animate={{ 
                                    scale: [1, 1.2, 1], 
                                    opacity: [1, 0.7, 1] 
                                }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-slate-600" />
                        )}
                      </div>
                      <div className={`text-sm tracking-wide ${done ? "text-slate-500 line-through" : active ? "text-white font-bold" : "text-slate-400"}`}>
                        {s}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar (Vibrant Gradient) */}
              <div className="mt-6">
                <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden shadow-inner shadow-black/50">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 to-fuchsia-500"
                    style={{ width: `${Math.min(progress, 98)}%` }}
                    transition={{ type: "tween", ease: "easeOut", duration: 0.5 }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                  <span>Data throughput stable...</span>
                  <span className="tabular-nums text-sm font-extrabold text-white">{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Time saved meter (Pulsating) */}
              <motion.div 
                className="mt-6 rounded-xl border-2 border-green-500/40 bg-black/60 p-4 shadow-2xl shadow-green-900/70"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-xs uppercase tracking-widest text-green-400">Efficiency Metric</div>
                <div className="mt-1 text-2xl font-extrabold text-white">
                  <motion.span
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                     ~{estSavedMinutes} min
                  </motion.span>
                </div>
                <div className="text-xs text-slate-500">Resource time optimized compared to manual synthesis.</div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GenerationRoom;