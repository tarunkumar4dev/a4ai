// src/components/LandingFeatures.tsx
import { FileText, Brain, Loader, Target } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";

const features = [
  {
    icon: FileText,
    title: "Hosted Tests + Analytics",
    description:
      "Share a link, collect responses, and see concept-level insights.",
  },
  {
    icon: Brain,
    title: "4+ AI Models",
    description:
      "Multiple models collaborate for higher quality and fewer hallucinations.",
  },
  {
    icon: Target,
    title: "99% Alignment",
    description:
      "Keyword-scoring & rubric checks keep questions on-target with your syllabus.",
  },
  {
    icon: Loader,
    title: "Under 1 Minute",
    description:
      "Create a complete, formatted paper and move straight to review.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export default function LandingFeatures() {
  // cursor-reactive glow in the section bg
  const mx = useMotionValue(300);
  const my = useMotionValue(120);
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const glow = useMotionTemplate`
    radial-gradient(600px 300px at ${mx}px ${my}px, rgba(110,124,142,0.18), transparent 70%),
    radial-gradient(600px 300px at ${useTransform(mx, (v) => v + 200)}px ${useTransform(
    my,
    (v) => v + 150
  )}px, rgba(173,184,199,0.16), transparent 70%)
  `;

  return (
    <section
      onMouseMove={onMouseMove}
      className="relative py-24 bg-[#f8f9fa] dark:bg-gray-950"
    >
      {/* soft grey-blue gradient mesh */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70 dark:opacity-50"
        style={{ backgroundImage: glow }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      variants={item}
      whileHover={{ y: -6, scale: 1.01 }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="relative group rounded-2xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-lg transition-all"
    >
      {/* gradient ring — neutral grey-blue */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset ring-transparent
                   [background:linear-gradient(transparent,transparent)_padding-box,linear-gradient(90deg,rgba(93,107,123,.45),rgba(175,186,199,.45))_border-box]
                   [border:1px_solid_transparent]"
      />

      {/* top shine on hover */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-1 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#5D6B7B]/0 via-[#5D6B7B]/40 to-[#5D6B7B]/0"
        initial={{ opacity: 0 }}
        animate={{ opacity: hover ? 1 : 0 }}
        transition={{ duration: 0.25 }}
      />

      {/* content */}
      <div className="relative z-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#5D6B7B]/15 to-[#6E7C8E]/15">
          <motion.div
            animate={{ rotate: hover ? 8 : 0, scale: hover ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <Icon className="h-7 w-7 text-[#5D6B7B]" />
          </motion.div>
        </div>

        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          {description}
        </p>
      </div>

      {/* bottom accent line */}
      <div className="absolute left-0 right-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[#5D6B7B]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
