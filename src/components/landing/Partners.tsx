// Partners.tsx — logo wall of institutes using a4ai. Logos are built into
// src/assets/partners by `python scripts/build-partner-logos.py`; a partner
// without a logo file is not shown.

const PARTNERS = [
  { id: "chanakya-institute", name: "Chanakya Institute of Education" },
  { id: "education-beast", name: "Education Beast" },
  { id: "anupama-institute", name: "Anupama Institute" },
  { id: "bright-line-institute", name: "Bright Line Institute" },
  { id: "physics-gram", name: "Physics Gram" },
];

const logos = import.meta.glob<string>("../../assets/partners/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const logoFor = (id: string) => logos[`../../assets/partners/${id}.webp`];

export default function Partners() {
  const partners = PARTNERS.filter((p) => logoFor(p.id));
  if (partners.length === 0) return null;

  return (
    <section aria-labelledby="partners-heading" className="relative overflow-hidden bg-white py-16 sm:py-20 lg:py-24 border-t border-[#E5E7EB]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-[70%] max-w-[1100px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(209,240,231,0.75), rgba(255,255,255,0))" }}
      />
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#D93F4D]">
          Our partners
        </p>
        <h2
          id="partners-heading"
          className="mt-3 text-center font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B] text-[1.75rem] leading-tight sm:text-[2.25rem] lg:text-[2.6rem]"
        >
          Institutes across India teach with a4ai
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] sm:text-[17px] text-[#5D6570]">
          Coaching institutes that use a4ai with their teachers and students.
        </p>

        <ul className="mt-10 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6">
          {partners.map((p) => (
            <li
              key={p.id}
              className="w-[calc(50%-0.5rem)] min-[560px]:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1.2rem)] flex flex-col items-center rounded-[22px] bg-white border border-black/[0.05] p-4 sm:p-5 shadow-[0_8px_30px_rgba(17,17,17,0.06)]"
            >
              <img
                src={logoFor(p.id)}
                alt={`${p.name} logo`}
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                className="h-24 sm:h-28 w-full max-w-[150px] object-contain"
              />
              <span className="mt-3 text-center text-[13px] sm:text-sm font-semibold leading-snug text-[#374151]">
                {p.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
