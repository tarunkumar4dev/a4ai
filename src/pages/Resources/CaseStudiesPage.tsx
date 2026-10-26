// src/pages/resources/CaseStudiesPage.tsx — no published case studies yet.
// (The old cards named schools and results that could not be verified.)
import { Link } from "react-router-dom";
import ResourcesLayout from "./ResourcesLayout";

export default function CaseStudiesPage() {
  return (
    <ResourcesLayout title="Case Studies" subtitle="How institutes use a4ai in their classrooms.">
      <div className="rounded-[24px] border border-dashed border-[#D1D5DB] p-10 text-center">
        <p className="text-[15px] text-[#5D6570]">No case studies are published yet.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1">
          <Link to="/about" className="min-h-[44px] inline-flex items-center text-[15px] font-bold text-[#111111] underline underline-offset-4">
            See our partners
          </Link>
          <Link to="/contact" className="min-h-[44px] inline-flex items-center text-[15px] font-bold text-[#111111] underline underline-offset-4">
            Talk to us
          </Link>
        </div>
      </div>
    </ResourcesLayout>
  );
}
