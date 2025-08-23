import ResourcesLayout from "./ResourcesLayout";

const cases = [
  { org: "Sunrise Public School", result: "Cut test creation time by 70%", blurb: "Teachers generate balanced papers in minutes and export to PDF." },
  { org: "STEM Hub Coaching", result: "3× faster iterating question banks", blurb: "Used our keyword scoring to keep topics precise." },
];

export default function CaseStudiesPage() {
  return (
    <ResourcesLayout title="Case Studies" subtitle="Real results from real classrooms.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cases.map((c) => (
          <div key={c.org} className="border rounded-xl p-5 bg-white/70 dark:bg-gray-950/60">
            <h3 className="font-semibold">{c.org}</h3>
            <p className="text-sm text-emerald-600 mt-1">{c.result}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{c.blurb}</p>
            <button className="mt-3 text-indigo-600 text-sm">View details →</button>
          </div>
        ))}
      </div>
    </ResourcesLayout>
  );
}
