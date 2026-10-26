// AboutPage.tsx — who builds a4ai and why. Same shell as the landing page.
// Team portraits come from src/assets/team (scripts/build-team-photos.py);
// a person without a portrait gets their initials instead.
import { Link } from "react-router-dom";
import { ArrowRight, Layers, Timer } from "lucide-react";
import PageShell, { BTN_PRIMARY, BTN_SECONDARY, Container, SectionHeading } from "@/components/site/PageShell";
import Partners from "@/components/landing/Partners";

interface Member {
  slug: string;
  name: string;
  role: string;
  tint: string;
}

const CORE_TEAM: Member[] = [
  { slug: "tarun-kumar-pathak", name: "Tarun Kumar Pathak", role: "Co-founder & Product", tint: "#FFE7E7" },
  { slug: "yash-dubey", name: "Yash Dubey", role: "Co-founder & Backend", tint: "#EFEDFF" },
  { slug: "aakash-singh", name: "Aakash Singh", role: "Co-founder & Marketing", tint: "#E4F8F3" },
  { slug: "nitin-kumar", name: "Nitin Kumar", role: "Founding Engineer", tint: "#FFF1E3" },
  { slug: "durgesh", name: "Durgesh", role: "Dev", tint: "#FFF0BF" },
];
const MENTOR: Member = { slug: "aman-singh", name: "Aman Singh", role: "Mentor", tint: "#EFEDFF" };

const MISSION = [
  {
    Icon: Timer,
    title: "Less repetitive work",
    body: "Setting papers, checking copies and keeping attendance take hours every week. a4ai does the repetitive part so teachers get that time back for their students.",
    bg: "linear-gradient(135deg, #FFEDEF 0%, #FFD9DE 100%)",
  },
  {
    Icon: Layers,
    title: "One workspace for teaching",
    body: "Test papers, answer checking, assignments, attendance and reports live in one place — for a single teacher or a whole institute.",
    bg: "linear-gradient(135deg, #E4F8F3 0%, #C9EFE4 100%)",
  },
];

const portraits = import.meta.glob<string>("../assets/team/*.webp", { eager: true, query: "?url", import: "default" });
const portrait = (slug: string) => {
  const small = portraits[`../assets/team/${slug}-320.webp`];
  const large = portraits[`../assets/team/${slug}-640.webp`];
  return small && large ? { src: large, srcSet: `${small} 320w, ${large} 640w` } : null;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Portrait({ member, eager, small }: { member: Member; eager?: boolean; small?: boolean }) {
  const img = portrait(member.slug);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${
        small ? "h-20 w-20 sm:h-[88px] sm:w-[88px]" : "h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-white shadow-[0_6px_20px_rgba(17,17,17,0.10)]"
      }`}
      style={{ backgroundColor: member.tint }}
    >
      {img ? (
        <img
          src={img.src}
          srcSet={img.srcSet}
          sizes="112px"
          width={320}
          height={320}
          alt={member.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center font-halenoir font-bold text-[#1B1B1B]/70 ${small ? "text-2xl" : "text-[1.75rem]"}`}
        >
          {initials(member.name)}
        </span>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <PageShell
      meta={{
        title: "About a4ai — Building better tools for education",
        description:
          "a4ai helps teachers and institutes create test papers, check answers, run attendance and prepare reports in one workspace. Meet the team.",
        path: "/about",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About a4ai",
          url: "https://a4ai.in/about",
          about: { "@type": "Organization", name: "a4ai", url: "https://a4ai.in" },
        },
      }}
    >
      {/* Hero */}
      <section
        className="py-16 sm:py-20 lg:py-24"
        style={{ background: "radial-gradient(900px 420px at 50% 0%, #FFF1EC 0%, rgba(255,255,255,0) 70%)" }}
      >
        <Container className="text-center">
          <span className="inline-flex items-center rounded-full px-3.5 py-1 text-xs sm:text-[13px] font-semibold bg-[#FFF1EC] text-[#D93F4D]">
            About a4ai
          </span>
          <h1
            className="mx-auto mt-5 max-w-3xl font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B]"
            style={{ fontSize: "clamp(2.1rem, 1.3rem + 3vw, 3.5rem)", lineHeight: 1.1 }}
          >
            Building Better Tools for <span className="text-[#F95D6A]">Education</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] sm:text-[18px] leading-relaxed text-[#5D6570]">
            a4ai helps teachers and institutes manage assessments, answer evaluation, attendance and academic reporting
            in one connected workspace.
          </p>
        </Container>
      </section>

      {/* Mission */}
      <section aria-labelledby="mission-heading" className="py-16 sm:py-20 border-t border-[#E5E7EB]">
        <Container>
          <SectionHeading id="mission-heading" eyebrow="Our mission" title="Give teachers their time back" />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {MISSION.map(({ Icon, title, body, bg }) => (
              <article key={title} className="rounded-[24px] p-6 sm:p-8 border border-black/[0.04]" style={{ backgroundImage: bg }}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-[#1B1B1B]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-halenoir text-xl sm:text-[1.4rem] font-bold text-[#1B1B1B]">{title}</h3>
                <p className="mt-2 text-[15px] sm:text-base leading-relaxed text-[#374151]">{body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Team */}
      <section aria-labelledby="team-heading" className="py-16 sm:py-20 bg-[#F7F8FA] border-t border-[#E5E7EB]">
        <Container>
          <SectionHeading id="team-heading" eyebrow="Team" title="The people behind a4ai" />

          <ul className="mx-auto mt-10 flex max-w-[1000px] flex-wrap justify-center gap-x-4 gap-y-8">
            {CORE_TEAM.map((m) => (
              <li key={m.slug} className="w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.7rem)] lg:w-[calc(20%-0.8rem)] flex flex-col items-center text-center">
                <Portrait member={m} eager />
                <h3 className="mt-3 text-[15px] sm:text-base font-bold leading-snug text-[#1B1B1B]">{m.name}</h3>
                <p className="text-[13px] sm:text-sm font-medium text-[#5D6570]">{m.role}</p>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-12 flex w-fit items-center gap-5 rounded-full bg-white border border-[#E5E7EB] py-3 pl-3 pr-9 shadow-[0_6px_20px_rgba(17,17,17,0.06)]">
            <Portrait member={MENTOR} small />
            <div className="text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#D93F4D]">{MENTOR.role}</p>
              <h3 className="text-[22px] font-bold leading-tight text-[#1B1B1B]">{MENTOR.name}</h3>
            </div>
          </div>
        </Container>
      </section>

      <Partners />

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-[#F7F8FA] border-t border-[#E5E7EB]">
        <Container className="text-center">
          <h2 className="font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B] text-[1.75rem] sm:text-[2.25rem] leading-tight">
            Try a4ai in your next class
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] sm:text-[17px] text-[#5D6570]">
            Create your first test paper free — no card needed.
          </p>
          <div className="mt-7 flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-center gap-3">
            <Link to="/dashboard/test-generator" className={BTN_PRIMARY}>
              Try for FREE <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/contact" className={BTN_SECONDARY}>
              Talk to us
            </Link>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
