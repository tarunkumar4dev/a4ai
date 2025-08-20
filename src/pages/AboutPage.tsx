import { useMemo, useRef, useState } from "react";
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
  Globe2,
  Bolt,
  BookOpenCheck,
  Building2,
  HeartHandshake,
  Quote,
  ArrowRight,
  Star,
} from "lucide-react";

// ---------------- Data ----------------
const team = [
  {
    name: "Tarun",
    role: "Founder & CEO",
    description: "Founder-led product thinker; drives vision, GTM, and educator experience.",
    image: "/images/tarun_a4ai.jpeg",
  },
  {
    name: "Yash",
    role: "CTO",
    description: "Full‑stack + ML; multi‑LLM orchestration, infra & security.",
    image: "/images/yash_a4ai.jpeg",
  },
  {
    name: "Aakash",
    role: "Growth & Community",
    description: "Runs outreach with schools, pilots, and partner programs.",
    image: "/images/aakash_a4ai.jpg",
  },
  {
    name: "Krishna",
    role: "Ops & Support",
    description: "Delight‑first ops; ensures contest reliability at scale.",
    image: "/images/krishna_a4ai.jpg",
  },
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
    quote:
      "We cut paper‑setting time by 80% and finally standardised difficulty across sections.",
    name: "Ritika Sharma",
    title: "HOD Science, Delhi",
  },
  {
    quote:
      "Proctoring is surprisingly humane—alerts were actionable and didn’t overwhelm invigilators.",
    name: "Arvind Rao",
    title: "Principal, Pune",
  },
];

const partners = [
  { name: "MSIT", logo: "/images/partner-msit.svg" },
  { name: "CBSE schools", logo: "/images/partner-cbse.svg" },
  { name: "SkillED", logo: "/images/partner-skilled.svg" },
  { name: "EduLabs", logo: "/images/partner-edulabs.svg" },
];

// --------------- Small helpers ---------------
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// --------------- Page ---------------
export default function AboutPage() {
  // cursor‑reactive glow
  const mx = useMotionValue(300);
  const my = useMotionValue(140);
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const heroGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, hsl(var(--primary)/0.10), transparent 70%),
    radial-gradient(800px 400px at calc(${mx}px + 220px) calc(${my}px + 140px), hsl(var(--primary)/0.08), transparent 70%)
  `;

  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-15% 0px" });

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'a4ai',
    url: 'https://a4ai.in',
    logo: 'https://a4ai.in/images/logo.png',
    sameAs: ['https://x.com/a4ai', 'https://www.linkedin.com/company/a4ai'],
  };

  return (
    <>
      <Helmet>
        <title>About a4ai — Building assessment tools that serve learning</title>
        <meta
          name="description"
          content="We’re a small team building AI‑powered test generation, proctoring, and analytics that respect pedagogy and privacy."
        />
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <meta property="og:title" content="About a4ai" />
        <meta property="og:description" content="AI‑powered assessments for real classrooms." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
        {/* HERO */}
        <section
          onMouseMove={onMouseMove}
          className="relative overflow-hidden py-24 md:py-28 text-gray-900 dark:text-white"
        >
          <motion.div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: heroGlow }} />
          <div className="absolute inset-0 -z-20 bg-[url('/images/grid.svg')] bg-center opacity-5 dark:opacity-[0.03]" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary" className="gap-1"><Sparkles className="h-3.5 w-3.5"/> Founded 2025</Badge>
              <Badge variant="secondary" className="gap-1"><Rocket className="h-3.5 w-3.5"/> Contest engine live</Badge>
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5"/> Privacy‑first</Badge>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="text-center text-5xl md:text-6xl font-extrabold tracking-tight mt-6"
            >
              About a4ai
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mx-auto mt-5 max-w-3xl text-center text-lg md:text-xl text-gray-600 dark:text-gray-300"
            >
              We’re building the assessment stack for Indian classrooms—
              fast, fair, and aligned to how teachers actually teach.
            </motion.p>

            {/* Stats */}
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
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
                  className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/50"
                >
                  <div className="text-2xl font-bold">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.k}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* MISSION */}
        <section ref={sectionRef} className="relative py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
              <h2 className="text-3xl md:text-4xl font-extrabold">Our mission</h2>
              <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed">
                Give teachers superpowers with AI that respects context and curriculum.
                Save hours every week and return that time to students.
              </p>
              <p className="mt-4 text-lg md:text-xl text-muted-foreground leading-relaxed">
                We combine multi‑LLM generation with rubric checks, plagiarism guards,
                and contest‑grade proctoring to ensure quality from day one.
              </p>
              <div className="mt-8 flex gap-3">
                <Button size="lg" className="rounded-xl">See how it works</Button>
                <Button size="lg" variant="outline" className="rounded-xl">Talk to us</Button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img src="/images/bg.jpg" alt="Educators using a4ai" className="aspect-video w-full object-cover" loading="lazy" />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* VALUES */}
        <section className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold">What we value</h3>
              <p className="mt-1 text-sm text-muted-foreground">Principles that steer product and policy.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((x, i) => (
                <motion.div
                  key={x.k}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="rounded-2xl border bg-gradient-to-b from-background to-muted/40 p-4"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><x.icon className="h-4 w-4"/> {x.k}</div>
                  <p className="mt-2 text-sm">{x.v}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h3 className="text-2xl font-bold text-center">Milestones</h3>
            <div className="mt-6 space-y-6">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45 }}
                  className="grid grid-cols-1 gap-3 rounded-2xl border bg-background/60 p-4 md:grid-cols-[140px_1fr]"
                >
                  <div className="text-sm font-medium text-muted-foreground">{m.date}</div>
                  <div>
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-sm text-muted-foreground">{m.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-16">
          <div className="absolute inset-0 bg-[url('/images/grid-dark.svg')] bg-center opacity-[0.03]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <motion.h2 {...fadeUp} className="mb-4 text-3xl md:text-4xl font-extrabold tracking-tight">Meet the team</motion.h2>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }} className="mx-auto max-w-3xl text-lg text-muted-foreground">
                Builder‑educators who care about the craft of assessment.
              </motion.p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m, i) => (
                <TeamCard key={m.name} index={i} member={m} />
              ))}
            </div>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold">Schools & partners</h3>
              <p className="mt-1 text-sm text-muted-foreground">Pilots and early adopters we’re grateful for.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
              {partners.map((p) => (
                <div key={p.name} className="flex items-center justify-center rounded-xl border bg-muted/30 p-4">
                  <img src={p.logo} alt={p.name} className="h-8 opacity-80" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map((t, i) => (
                <motion.blockquote
                  key={t.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.05 * i }}
                  className="relative rounded-2xl border bg-background/60 p-6"
                >
                  <Quote className="absolute -top-3 -left-3 h-6 w-6 text-primary" />
                  <p className="text-base">{t.quote}</p>
                  <footer className="mt-4 text-sm text-muted-foreground">— {t.name}, {t.title}</footer>
                </motion.blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-b from-gray-900 to-black py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl md:text-4xl font-extrabold">
              Ready to transform your assessments?
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }} className="mx-auto mt-3 max-w-3xl text-lg text-white/80">
              Join educators using a4ai to save time and improve outcomes.
            </motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.25, duration: 0.5 }} className="mt-8 flex justify-center gap-3">
              <Button className="rounded-xl bg-white px-8 py-6 text-lg font-semibold text-gray-900 shadow-lg hover:bg-gray-100">
                Get started for free
              </Button>
              <Button variant="outline" className="rounded-xl bg-transparent px-8 py-6 text-lg text-white">
                Book a demo <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}

// ------- Team Card (tilt + glow) -------
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
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 * index }}
      className="relative"
    >
      <div
        onMouseMove={onMove}
        onMouseLeave={() => {
          mx.set(160);
          my.set(120);
        }}
        style={{ perspective: 1000 }}
        className="group"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_18px_50px_rgba(0,0,0,0.06)] transition-all duration-300 will-change-transform"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background: useMotionTemplate`
                radial-gradient(160px 110px at ${mx}px ${my}px, hsl(var(--primary)/0.10), transparent 70%)
              `,
            }}
          />

          <div className="relative z-10 text-center">
            <Avatar className="mx-auto mb-4 h-28 w-28 ring-1 ring-black/10 dark:ring-white/10">
              <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-3xl font-bold">
                {member.name.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-bold">{member.name}</h3>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{member.role}</p>
            <p className="mt-3 text-sm text-foreground/90">{member.description}</p>
          </div>

          <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
        </motion.div>
      </div>
    </motion.div>
  );
}