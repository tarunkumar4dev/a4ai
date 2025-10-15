import { useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useMotionTemplate,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet";
import {
  Sparkles,
  Target,
  ShieldCheck,
  Rocket,
  Bolt,
  BookOpenCheck,
  Quote,
  ArrowRight,
  Gauge,
  Shield,
  BookOpen,
} from "lucide-react";

/* ================== Cluely Theme Tokens (Monochrome) ================== */
const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const sectionX = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

// Monochrome palette (Cluely-style inky greys, no blues/purples)
const TOKENS = {
  INK: {
    50: "#EEF2F6",
    100: "#E3E9F1",
    200: "#CED7E3",
    300: "#AEBBCD",
    400: "#8C9AAF",
    500: "#6B7C93",
    600: "#566679",
    700: "#435260",
    800: "#2F3A44",
    900: "#1F2830",
  },
  SURFACE: {
    light: "#F5F6F8",
    mid: "#E9EDF3",
    dark: "#0F141A",
  },
  BRAND: {
    // Deep neutral gradient instead of indigo/purple
    from: "from-[#0B0C0E]",
    via: "via-[#161A1F]",
    to: "to-[#2A2F37]",
  },
};

const primaryGrad = `bg-gradient-to-r ${TOKENS.BRAND.from} ${TOKENS.BRAND.via} ${TOKENS.BRAND.to} text-white hover:opacity-95`;

/* ================== Data ================== */
const team = [
  { name: "Tarun", role: "Co-Founder", description: "Technology · Marketing", image: "/images/tarun_a4ai.jpeg" },
  { name: "Yash", role: "Co-Founder", description: "Tech Lead", image: "/images/yash_a4ai.jpeg" },
  { name: "Aakash", role: "Co-Founder", description: "Tech Support · Cloud", image: "/images/aakash_a4ai.jpg" },
  { name: "Krishna", role: "Co-Founder", description: "COO", image: "/images/krishna_a4ai.jpg" },
];

const values = [
  { icon: Target, k: "Outcomes > Outputs", v: "We obsess over student learning gains and teacher time saved." },
  { icon: ShieldCheck, k: "Trust by design", v: "Privacy‑first data handling with clear controls and audit trails." },
  { icon: BookOpenCheck, k: "Pedagogy‑aware AI", v: "Questions that align to curriculum, not just prompt magic." },
  { icon: Bolt, k: "Speed with dignity", v: "From prompt to paper in under 2 min—without cutting corners." },
];

const milestones = [
  { date: "Apr 2025", title: "a4ai is founded", detail: "Validated the pain: teachers spend 6–10 hrs/week creating papers." },
  { date: "Jun 2025", title: "Private alpha", detail: "First 50 teachers, 1K+ papers generated; tight build‑with loop." },
  { date: "Aug 2025", title: "Contest engine MVP", detail: "Proctored live contests with camera checks & screen‑lock." },
  { date: "Q4 2025", title: "Institutes beta", detail: "Custom branding, SSO, and advanced analytics for campuses." },
];

const testimonials = [
  {
    quote: "We cut paper‑setting time by 80% and finally standardised difficulty across sections.",
    name: "Ritika Sharma",
    title: "HOD Science, Delhi",
  },
  {
    quote: "Proctoring is surprisingly humane—alerts were actionable and didn't overwhelm invigilators.",
    name: "Arvind Rao",
    title: "Principal, Pune",
  },
];

const partners = [
  { name: "Chanakya", logo: "/images/partner-msit.svg" },
  { name: "CBSE schools", logo: "/images/partner-cbse.svg" },
  { name: "SkillED", logo: "/images/partner-skilled.svg" },
  { name: "EduLabs", logo: "/images/partner-edulabs.svg" },
];

/* ================== Variants ================== */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

/* ================== Page ================== */
export default function AboutPage() {
  // Cursor reactive hero glow (neutral tints)
  const mx = useMotionValue(320);
  const my = useMotionValue(160);

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  const heroGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(0,0,0,0.12), transparent 70%),
    radial-gradient(780px 420px at calc(${mx}px + 240px) calc(${my}px + 160px), rgba(0,0,0,0.08), transparent 70%)
  `;

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-12% 0px" });

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "a4ai",
    url: "https://a4ai.in",
    logo: "https://a4ai.in/images/logo.png",
    sameAs: ["https://x.com/a4ai", "https://www.linkedin.com/company/a4ai"],
  };

  return (
    <>
      <Helmet>
        <title>About a4ai — Smart, simple, secure assessments</title>
        <meta name="description" content="We're a small team building AI‑powered test generation, proctoring, and analytics that respect pedagogy and privacy." />
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <meta property="og:title" content="About a4ai" />
        <meta property="og:description" content="AI-powered assessments for real classrooms." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen font-['Halenoir_Expanded',Inter,system-ui,sans-serif] bg-[radial-gradient(1000px_800px_at_10%_-10%,#EFF2F6_0%,transparent_60%),radial-gradient(1000px_800px_at_90%_-20%,#ECEEF2_0%,transparent_55%)] dark:bg-[radial-gradient(1000px_800px_at_10%_-10%,#0D1116_0%,transparent_60%),radial-gradient(1000px_800px_at_90%_-20%,#0B0E12_0%,transparent_55%)]">
        {/* Grid overlay */}
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[url('/images/grid.svg')] bg-center opacity-[0.06] dark:opacity-[0.03]" />

        {/* HERO */}
        <section onMouseMove={onMouseMove} className="relative overflow-hidden py-24 md:py-28">
          <motion.div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: heroGlow }} />
          {/* floating orbs (neutral) */}
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-neutral-300/30 to-zinc-200/30 blur-3xl" />
          <div className="absolute -right-16 top-1/3 h-60 w-60 rounded-full bg-gradient-to-br from-zinc-400/30 to-stone-300/30 blur-3xl" />

          <div className={sectionX}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              <Badge variant="secondary" className="gap-1 border border-white/30 bg-white/70 backdrop-blur dark:bg-white/10 dark:border-white/10 text-[13px]">
                <Sparkles className="h-3.5 w-3.5"/> Founded 2025
              </Badge>
              <Badge variant="secondary" className="gap-1 border border-white/30 bg-white/70 backdrop-blur dark:bg-white/10 dark:border-white/10 text-[13px]">
                <Rocket className="h-3.5 w-3.5"/> Contest engine live
              </Badge>
              <Badge variant="secondary" className="gap-1 border border-white/30 bg-white/70 backdrop-blur dark:bg-white/10 dark:border-white/10 text-[13px]">
                <ShieldCheck className="h-3.5 w-3.5"/> Privacy‑first
              </Badge>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-center text-4xl md:text-6xl font-extrabold tracking-tight text-[--ink-900] dark:text-white"
              style={{
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                ['--ink-900']: TOKENS.INK[900],
              }}
            >
              About a4ai
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
              className="mx-auto mt-6 max-w-3xl text-center text-lg md:text-xl text-[rgb(67,82,96)]/80 dark:text-gray-300"
            >
              Building the assessment stack for Indian classrooms—fast, fair, and aligned to how teachers actually teach.
            </motion.p>

            {/* Stats (neumorphic cards) */}
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { k: "Papers", v: "3.5K+" },
                { k: "Schools", v: "25+" },
                { k: "Uptime", v: "99.9%" },
                { k: "Avg. Gen Time", v: "< 2 min" },
              ].map((s, i) => (
                <motion.div
                  key={s.k}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="rounded-2xl border border-white/40 bg-white/70 p-4 text-center shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60"
                >
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.v}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{s.k}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* MISSION */}
        <section ref={sectionRef} className="relative py-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="[&_h2]:tracking-tight"
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">Our mission</h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-700/90 dark:text-gray-300">
                Give teachers superpowers with AI that respects context and curriculum. Save hours weekly and return that time to students.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-gray-700/90 dark:text-gray-300">
                We combine multi‑LLM generation with rubric checks, plagiarism guards,
                and contest‑grade proctoring to ensure quality from day one.
              </p>

              {/* Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" className={`rounded-xl px-6 shadow-lg ${primaryGrad}`}>
                  See how it works
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl px-6 border-white/30 bg-white/60 backdrop-blur hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/10">
                  Talk to us
                </Button>
              </div>

              {/* Feature chips */}
              <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { icon: Gauge, title: "Faster prep", copy: "Create aligned tests in minutes, not evenings." },
                  { icon: Shield, title: "Safer data", copy: "Privacy-first storage, clear consent, audit trails." },
                  { icon: BookOpen, title: "Better pedagogy", copy: "Curriculum mapping + rubric checks by default." },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-white/40 bg-white/70 p-4 shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60"
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      <item.icon className="h-4 w-4 text-gray-800 dark:text-gray-200" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm text-gray-700/90 dark:text-gray-300">{item.copy}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
              <Card className="overflow-hidden border-0 shadow-xl rounded-3xl">
                <CardContent className="p-0">
                  <img
                    src="/images/bg.jpg"
                    alt="Educators using a4ai"
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* VALUES */}
        <section className="py-20">
          <div className={sectionX}>
            <div className="mb-12 text-center">
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">What we value</h3>
              <p className="mt-3 text-gray-700/80 dark:text-gray-300">Principles that steer product and policy.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((x, i) => (
                <motion.div
                  key={x.k}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60"
                >
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                    <x.icon className="h-5 w-5 text-gray-800 dark:text-gray-200" />
                    {x.k}
                  </div>
                  <p className="mt-3 text-gray-700/90 dark:text-gray-300">{x.v}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h3 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">Milestones</h3>
            <div className="mt-12 space-y-8">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45 }}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60 md:grid-cols-[140px_1fr]"
                >
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{m.date}</div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{m.title}</div>
                    <div className="mt-2 text-gray-700/90 dark:text-gray-300">{m.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section className="relative py-20">
          <div className="absolute inset-0 bg-[url('/images/grid-dark.svg')] bg-center opacity-[0.03] pointer-events-none" />
          <div className={sectionX}>
            <div className="text-center">
              <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-6">
                Meet the team
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mx-auto max-w-3xl text-lg text-gray-700/85 dark:text-gray-300"
              >
                Builder‑educators who care about the craft of assessment.
              </motion.p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m, i) => (
                <TeamCard key={m.name} index={i} member={m} />
              ))}
            </div>

            <p className="mt-12 text-center text-gray-600 dark:text-gray-400">
              …and many more builders behind the screen—mentors, teachers, and student testers who shape a4ai every week.
            </p>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">Schools & partners</h3>
              <p className="mt-3 text-gray-700/80 dark:text-gray-300">Pilots and early adopters we're grateful for.</p>
            </div>
            <div className="mt-12 grid grid-cols-2 items-center gap-8 sm:grid-cols-4">
              {partners.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-center p-6 rounded-xl border border-white/40 bg-white/70 backdrop-blur shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] dark:border-white/10 dark:bg-[#0F141A]/60"
                >
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-8 opacity-80 grayscale hover:grayscale-0 transition-all duration-300"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid gap-8 md:grid-cols-2">
              {testimonials.map((t, i) => (
                <motion.blockquote
                  key={t.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.05 * i }}
                  className="relative rounded-2xl border border-white/40 bg-white/70 p-8 shadow-[0_8px_30px_rgb(31_40_48_/_0.06)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60"
                >
                  <Quote className="absolute -top-3 -left-3 h-6 w-6 text-gray-500" />
                  <p className="text-lg text-gray-800 dark:text-gray-300 italic">"{t.quote}"</p>
                  <footer className="mt-6 font-semibold text-gray-900 dark:text-white">
                    {t.name}, <span className="text-gray-600 dark:text-gray-400 font-normal">{t.title}</span>
                  </footer>
                </motion.blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* CTA (Neutral gradient) */}
        <section className="bg-gradient-to-br from-[#0B0C0E] via-[#161A1F] to-[#2A2F37] py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
            >
              Ready to transform your assessments?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="mx-auto mt-4 max-w-3xl text-lg text-zinc-200"
            >
              Join educators using a4ai to save time and improve outcomes.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="mt-8 flex flex-col sm:flex-row justify-center gap-4"
            >
              <Button size="lg" className="rounded-xl bg-white px-8 py-6 text-lg font-semibold text-gray-900 shadow-lg hover:bg-gray-100">
                Get started for free
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl border-white bg-transparent px-8 py-6 text-lg font-semibold text-white hover:bg-white hover:text-gray-900">
                Book a demo <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ================== Team Card ================== */
function TeamCard({
  member,
  index,
}: {
  member: { name: string; role: string; description: string; image: string };
  index: number;
}) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);
  const rotateX = useTransform(my, [0, 260], [8, -8]);
  const rotateY = useTransform(mx, [0, 300], [-10, 10]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  const onLeave = () => {
    mx.set(160);
    my.set(120);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: EASE }}
      className="relative"
    >
      <div onMouseMove={onMove} onMouseLeave={onLeave} style={{ perspective: 1000 }} className="group cursor-pointer">
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_12px_40px_rgb(31_40_48_/_0.10)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(31_40_48_/_0.18)] backdrop-blur dark:border-white/10 dark:bg-[#0F141A]/60"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: useMotionTemplate`
                radial-gradient(160px 110px at ${mx}px ${my}px, rgba(0,0,0,0.12), transparent 70%)
              `,
            }}
          />
          <div className="relative z-10 text-center">
            <Avatar className="mx-auto mb-4 h-28 w-28 ring-2 ring-white/60 dark:ring-white/10">
              <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              <AvatarFallback className="bg-gray-100 text-gray-700 dark:bg-[#1A222B] dark:text-gray-200 text-xl font-bold">
                {member.name.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{member.name}</h3>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{member.role}</p>
            <p className="mt-3 text-gray-700/90 dark:text-gray-300">{member.description}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}