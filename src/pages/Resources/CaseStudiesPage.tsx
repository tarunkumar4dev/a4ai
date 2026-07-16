// src/pages/resources/CaseStudiesPage.tsx
import React from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ResourcesLayout from "./ResourcesLayout";

const cases = [
  { org: "Sunrise Public School", result: "Cut test creation time by 70%", blurb: "Teachers generate balanced papers in minutes and export directly to native templates." },
  { org: "STEM Hub Coaching", result: "3× faster iterating question banks", blurb: "Leveraged our outcome coverage layers to keep lesson objectives aligned and balanced." },
];

function CaseCard({ c }: { c: typeof cases[0] }) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);

  return (
    <div
      className="group relative h-full select-none"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => { mx.set(160); my.set(120); }}
    >
      {/* Structural ag-card configurations read entirely from the core light engine rules */}
      <div className="ag-card h-full flex flex-col p-6 transition-all duration-300 bg-white">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
        />

        <div className="relative z-10 flex flex-col h-full bg-transparent">
          <h3 className="text-lg font-bold mb-1 text-neutral-900">{c.org}</h3>
          <p className="text-sm font-bold mb-3 text-emerald-600">{c.result}</p>
          <p className="text-sm leading-relaxed mb-6 flex-grow text-neutral-500">{c.blurb}</p>
          
          <button className="flex items-center gap-1.5 text-sm font-semibold transition-colors mt-auto w-fit text-blue-600 hover:text-blue-700 bg-transparent">
            View case study <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseStudiesPage() {
  return (
    <ResourcesLayout title="Case Studies" subtitle="Real, data-backed assessment improvements inside live classrooms.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
        {cases.map((c) => (
          <CaseCard key={c.org} c={c} />
        ))}
      </div>
    </ResourcesLayout>
  );
}