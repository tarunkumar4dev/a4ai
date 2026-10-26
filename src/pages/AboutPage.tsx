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
  { slug: "tarun-kumar-pathak", name: "Tarun Kumar Pathak", role: "Founder & CEO", tint: "#FFE7E7" },
  { slug: "yash-dubey", name: "Yash Dubey", role: "Co-Founder", tint: "#EFEDFF" },
  { slug: "aakash-singh", name: "Aakash Singh", role: "Co-Founder", tint: "#E4F8F3" },
  { slug: "nitin-kumar", name: "Nitin Kumar", role: "Founding Engineer", tint: "#FFF1E3" },
  { slug: "durgesh", name: "Durgesh", role: "Marketing", tint: "#FFF0BF" },
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

function Portrait({ member, sizes, eager }: { member: Member; sizes: string; eager?: boolean }) {
  const img = portrait(member.slug);
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl" style={{ backgroundColor: member.tint }}>
      {img ? (
        <img
          src={img.src}
          srcSet={img.srcSet}
          sizes={sizes}
          width={640}
          height={640}
          alt={member.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-halenoir text-[2.5rem] font-bold text-[#1B1B1B]/70"
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

          <ul className="mx-auto mt-10 flex max-w-[960px] flex-wrap justify-center gap-5">
            {CORE_TEAM.map((m) => (
              <li key={m.slug} className="w-full min-[480px]:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.84rem)] rounded-[24px] bg-white border border-[#E5E7EB] p-4 shadow-[0_8px_30px_rgba(17,17,17,0.05)]">
                <Portrait member={m} sizes="(min-width: 1024px) 300px, (min-width: 480px) 45vw, 90vw" eager />
                <h3 className="mt-4 px-1 text-lg font-bold text-[#1B1B1B]">{m.name}</h3>
                <p className="px-1 pb-1 text-[15px] font-medium text-[#5D6570]">{m.role}</p>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-5 max-w-[960px] rounded-[24px] bg-white border border-[#E5E7EB] p-4 sm:p-5 shadow-[0_8px_30px_rgba(17,17,17,0.05)] flex items-center gap-4 sm:gap-6">
            <div className="w-20 sm:w-24 shrink-0">
              <Portrait member={MENTOR} sizes="96px" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D93F4D]">{MENTOR.role}</p>
              <h3 className="mt-1 text-lg font-bold text-[#1B1B1B]">{MENTOR.name}</h3>
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
