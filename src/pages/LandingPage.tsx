// src/pages/LandingPage.tsx
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingDemo from "@/components/LandingDemo";
import LandingFeatures from "@/components/LandingFeatures";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

import { Button } from "@/components/ui/button";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";

/* -------------------- Animation presets (consistent) -------------------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export default function LandingPage() {
  const founders = [
    {
      name: "Tarun",
      role: "Team Member",
      description: "Tech Team",
      initials: "TA",
      image: "/images/tarun_a4ai.jpeg",
      linkedin: "#",
      twitter: "#",
    },
    {
      name: "Yash",
      role: "Team Member",
      description: "Tech Team",
      initials: "YA",
      image: "/images/yash_a4ai.jpeg",
      linkedin: "#",
      twitter: "#",
    },
    {
      name: "Aakash",
      role: "Team Member",
      description: "Operations Team",
      initials: "AK",
      image: "/images/aakash_a4ai.jpg",
      linkedin: "#",
      twitter: "#",
    },
    {
      name: "Krishna",
      role: "Team Member",
      description: "Operations Team",
      initials: "KR",
      image: "/images/krishna_a4ai.jpg",
      linkedin: "#",
      twitter: "#",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <Navbar />

      <main className="flex-grow">
        {/* HERO */}
        <LandingHero />

        {/* DEMO */}
        <LandingDemo />

        {/* FEATURES */}
        <LandingFeatures />

        {/* FAQ */}
        <FAQ />

        {/* How It Works */}
        <motion.section
          className="bg-gradient-to-b from-gray-50 to-white py-20 dark:from-gray-900 dark:to-gray-950"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div className="mb-16 text-center" variants={fadeUp}>
              <h2 className="mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-4xl font-extrabold text-transparent">
                How It Works
              </h2>
              <p className="mx-auto max-w-3xl text-xl text-gray-600 dark:text-gray-300">
                Our AI-powered system creates high-quality test papers in just a few simple steps.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-10 md:grid-cols-3"
              variants={container}
            >
              {[
                {
                  title: "Choose Your Specifications",
                  desc: "Select subject, difficulty, question type, and other parameters for your test.",
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  ),
                },
                {
                  title: "AI Models Generate Content",
                  desc: "Multiple AI models create questions and answers based on your specifications.",
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ),
                },
                {
                  title: "Download Your Test Paper",
                  desc: "Get your professionally formatted test paper ready for distribution.",
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl dark:border-gray-700 dark:bg-gray-800"
                  variants={fadeUp}
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    {item.icon}
                  </div>
                  <h3 className="mb-3 text-xl font-bold dark:text-white">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Upgraded CTA */}
            <UpgradedCTA />
          </div>
        </motion.section>

        {/* Team */}
        <TeamSection founders={founders} />

        {/* Testimonials */}
        <motion.section
          className="bg-gradient-to-b from-gray-50 to-white py-20 dark:from-gray-900 dark:to-gray-950"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div className="mb-16 text-center" variants={fadeUp}>
              <h2 className="mb-4 text-4xl font-extrabold text-gray-900 dark:text-white">What Educators Say</h2>
              <p className="mx-auto max-w-3xl text-xl text-gray-600 dark:text-gray-300">
                Thousands of teachers trust a4ai to save time and improve student outcomes.
              </p>
            </motion.div>

            <motion.div className="grid grid-cols-1 gap-10 md:grid-cols-3" variants={container}>
              {[
                {
                  quote:
                    "a4ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging.",
                  name: "Rahul Verma",
                  title: "Director, Education Beast",
                },
                {
                  quote:
                    "The variety of question types and difficulty levels makes this perfect for creating differentiated assessments for my diverse classroom.",
                  name: "Abhay Gupta",
                  title: "Director, Chanakya Institute",
                },
                {
                  quote:
                    "I was skeptical about AI-generated content, but a4ai surprised me with its accuracy and curriculum-aligned questions.",
                  name: "Aman Singh",
                  title: "Chemistry Teacher (10+ Years Exp)",
                },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
                  variants={fadeUp}
                >
                  <div className="mb-6 flex items-center">
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold dark:text-white">{t.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t.title}</p>
                    </div>
                  </div>
                  <p className="italic text-gray-600 dark:text-gray-300">"{t.quote}"</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          className="bg-gradient-to-r from-indigo-600 to-purple-600 py-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              Ready to Transform Your Assessment Process?
            </h2>
            <p className="mx-auto mb-10 max-w-3xl text-xl text-white/90">
              Join thousands of educators who are saving time and improving student outcomes with a4ai.
            </p>
            <Link to="/signup">
              <Button
                size="lg"
                className="rounded-xl bg-white px-10 py-6 text-lg font-semibold text-indigo-600 shadow-lg transition hover:bg-gray-100 hover:scale-105"
              >
                Get Started For Free
              </Button>
            </Link>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}

/* =========================
   Upgraded CTA
   ========================= */
   function UpgradedCTA() {
    return (
      <motion.div variants={fadeUp} className="mx-auto mt-16 max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white p-8 shadow-xl backdrop-blur
                        dark:border-white/10 dark:bg-white/5">
          {/* decorative frame (always BELOW content) */}
          <div
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl ring-1 ring-inset ring-transparent
                       [background:linear-gradient(white,white)_padding-box,linear-gradient(90deg,rgba(99,102,241,.35),rgba(168,85,247,.35))_border-box]
                       [border:1px_solid_transparent]" />
  
          {/* content (always ABOVE frame) */}
          <div className="relative z-10 text-center text-gray-900 dark:text-gray-100">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs
                            tracking-wide text-gray-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              No credit card required
            </div>
  
            <h3 className="text-2xl font-bold">Create Your First Test in Minutes</h3>
            <p className="mx-auto mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
              Start with a topic or paste your syllabus. We’ll generate a fully formatted paper with answer key and rubric checks.
            </p>
  
            <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {["Curriculum-aligned", "Multiple question types", "Instant answer key"].map((b) => (
                <div key={b} className="flex items-center justify-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-indigo-600" />
                  {b}
                </div>
              ))}
            </div>
  
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/dashboard/test-generator">
                <Button className="group rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-6 text-base font-semibold text-white
                                    hover:from-indigo-700 hover:to-purple-700">
                  Create Your First Test
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link to="/demo">
                <Button variant="outline"
                        className="rounded-xl border-gray-300/70 px-7 py-6 text-base font-semibold dark:border-white/20">
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  

/* =========================
   Team Section
   ========================= */
function TeamSection({
  founders,
}: {
  founders: Array<{
    name: string;
    role: string;
    description: string;
    initials: string;
    image: string;
    linkedin: string;
    twitter: string;
  }>;
}) {
  const mx = useMotionValue(300);
  const my = useMotionValue(120);
  const glow = useMotionTemplate`
    radial-gradient(700px 350px at ${mx}px ${my}px, rgba(99,102,241,0.10), transparent 70%),
    radial-gradient(700px 350px at calc(${mx}px + 180px) calc(${my}px + 120px), rgba(168,85,247,0.08), transparent 70%)
  `;
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  return (
    <motion.section
      onMouseMove={onMove}
      className="relative bg-white py-20 dark:bg-gray-950"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.div aria-hidden style={{ backgroundImage: glow }} className="pointer-events-none absolute inset-0 -z-10 opacity-90" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mb-16 text-center" variants={fadeUp}>
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">Meet Our Team</h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">The brilliant minds behind a4ai</p>
        </motion.div>

        <motion.div className="grid grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-4" variants={container}>
          {founders.map((person, i) => (
            <TeamCard key={person.name} person={person} index={i} />
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

function TeamCard({
  person,
  index,
}: {
  person: {
    name: string;
    role: string;
    description: string;
    initials: string;
    image: string;
    linkedin: string;
    twitter: string;
  };
  index: number;
}) {
  return (
    <motion.div variants={fadeUp} transition={{ delay: 0.06 * index }} whileHover={{ y: -6 }} className="group relative">
      <Card className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/80 p-6 shadow-lg backdrop-blur transition-shadow hover:shadow-xl dark:border-white/10 dark:bg-white/[0.06]">
        {/* gradient frame */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-transparent [background:linear-gradient(white,white)_padding-box,linear-gradient(90deg,rgba(99,102,241,.35),rgba(168,85,247,.35))_border-box] [border:1px_solid_transparent]" />

        {/* top glint */}
        <div className="pointer-events-none absolute -top-1 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500/0 via-indigo-500/40 to-purple-500/0 opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-indigo-500/15 to-purple-500/15 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
            <Avatar className="h-28 w-28 border-4 border-white shadow-lg dark:border-gray-800">
              <AvatarImage src={person.image} alt={person.name} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-r from-purple-600 to-indigo-600 text-3xl font-bold text-white">
                {person.initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{person.name}</h3>
          <div className="mt-1 inline-flex items-center gap-2">
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200">
              {person.role}
            </span>
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-gray-700 dark:bg白/10 dark:text-gray-200">
              {person.description}
            </span>
          </div>

          {/* socials */}
          <div className="mt-4 flex gap-3">
            <a
              href={person.linkedin}
              aria-label={`${person.name} on LinkedIn`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-indigo-600 hover:text-white dark:bg-gray-800 dark:text-gray-300"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5V5c0-2.761-2.238-5-5-5zM8 19H5V8h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764S5.534 3.204 6.5 3.204c.966 0 1.75.79 1.75 1.764s-.784 1.764-1.75 1.764zM20 19h-3v-5.604c0-3.368-4-3.113-4 0V19h-3V8h3v1.765C14.396 7.179 20 6.988 20 12.24V19z" />
              </svg>
            </a>
            <a
              href={person.twitter}
              aria-label={`${person.name} on X`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-indigo-600 hover:text-white dark:bg-gray-800 dark:text-gray-300"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743A11.65 11.65 0 012.8 9.713v.052A4.105 4.105 0 006.092 13.787a4.095 4.095 0 01-1.853.07A4.108 4.108 0 008.073 16.707 8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
          </div>
        </div>

        <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </Card>
    </motion.div>
  );
}
