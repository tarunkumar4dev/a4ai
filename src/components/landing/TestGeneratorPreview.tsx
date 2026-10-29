// TestGeneratorPreview.tsx — the coded Test Generator card from the old hero,
// sized in em so it scales with the showcase frame (font-size comes from the
// frame width via .a4-tg-preview in index.css). Decorative: the slide's text
// and alt describe it.
import { ArrowRight, Check, FileText } from "lucide-react";

const CHAPTERS = [
  { num: "01", name: "Real Numbers", qs: "8 Questions", marks: "16 Marks" },
  { num: "02", name: "Polynomials", qs: "12 Questions", marks: "32 Marks" },
  { num: "03", name: "Pair of Linear Equations", qs: "12 Questions", marks: "32 Marks" },
];

export default function TestGeneratorPreview() {
  return (
    <div className="a4-tg-preview h-full w-full flex flex-col justify-between bg-[#F7F8FA] p-[1.1em] select-none">
      <div className="flex items-start justify-between gap-[0.8em]">
        <div className="min-w-0">
          <div className="flex items-center gap-[0.45em]">
            <FileText className="h-[1em] w-[1em] text-[#F95D6A] shrink-0" />
            <span className="text-[0.95em] font-bold text-[#1B1B1B] truncate">Create New Test Paper</span>
          </div>
          <p className="text-[0.7em] text-[#5D6570] mt-[0.2em] truncate">
            Section-wise assessment with answer keys &amp; marking scheme
          </p>
        </div>
        <span className="text-[0.7em] font-bold text-[#D93F4D] bg-[#FFF1EC] px-[0.8em] py-[0.3em] rounded-full border border-[#FECDD3] whitespace-nowrap">
          32 Qs • 80 Marks
        </span>
      </div>

      <div className="grid grid-cols-2 gap-[0.6em]">
        {[
          ["Subject", "Mathematics (041)"],
          ["Curriculum & Class", "CBSE — Class 10"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[0.7em] bg-white border border-[#E5E7EB] px-[0.75em] py-[0.55em] min-w-0">
            <span className="block text-[0.6em] font-semibold text-[#5D6570] uppercase tracking-wider truncate">{k}</span>
            <span className="block text-[0.82em] font-bold text-[#1B1B1B] mt-[0.1em] truncate">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[0.45em]">
        {CHAPTERS.map((ch) => (
          <div
            key={ch.num}
            className="flex items-center justify-between rounded-[0.7em] bg-white border border-[#E5E7EB] px-[0.75em] py-[0.5em]"
          >
            <div className="flex items-center gap-[0.6em] min-w-0">
              <span className="w-[1em] h-[1em] rounded-[0.25em] bg-[#F95D6A] text-white flex items-center justify-center shrink-0">
                <Check className="h-[0.75em] w-[0.75em] stroke-[3]" />
              </span>
              <span className="text-[0.76em] font-semibold text-[#1B1B1B] truncate">
                Ch {ch.num}: {ch.name}
              </span>
            </div>
            <div className="flex items-center gap-[0.5em] shrink-0 ml-[0.5em]">
              <span className="text-[0.65em] text-[#5D6570]">{ch.marks}</span>
              <span className="text-[0.65em] font-semibold text-[#047857] bg-[#E8F6F1] px-[0.6em] py-[0.15em] rounded-[0.3em]">
                {ch.qs}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[0.7em] bg-[#FFF1EC] border border-[#FECDD3] px-[0.75em] py-[0.45em] flex items-center justify-between gap-[0.6em]">
        <span className="text-[0.7em] font-bold text-[#D93F4D] whitespace-nowrap">Bloom's Taxonomy Blueprint</span>
        <span className="text-[0.65em] text-[#5D6570] truncate">Sections A–E (MCQ, Short, Long, Case)</span>
      </div>

      <div className="flex items-center gap-[0.6em]">
        <div className="flex-1 rounded-[0.7em] bg-[#111111] py-[0.6em] flex items-center justify-center gap-[0.4em]">
          <span className="text-[0.78em] font-bold text-white">Generate Paper</span>
          <ArrowRight className="h-[0.85em] w-[0.85em] text-[#F95D6A]" />
        </div>
        <div className="flex items-center gap-[0.4em] rounded-[0.7em] bg-white border border-[#E5E7EB] px-[0.8em] py-[0.6em] shrink-0">
          <FileText className="h-[0.85em] w-[0.85em] text-[#047857]" />
          <span className="text-[0.72em] font-semibold text-[#1B1B1B]">PDF &amp; DOCX</span>
        </div>
      </div>
    </div>
  );
}
