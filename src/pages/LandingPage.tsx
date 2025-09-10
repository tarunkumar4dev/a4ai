// src/pages/LandingPage.tsx
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingDemo from "@/components/LandingDemo";
import LandingFeatures from "@/components/LandingFeatures";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
                    <svg xmlns="http://www.w3.org/200/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
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

        {/* Trust / Security / Logos */}
        <TrustSecurity />

        {/* Outcomes & Stats */}
        <Outcomes />

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
              <Button
                variant="outline"
                className="rounded-xl border-gray-300/70 px-7 py-6 text-base font-semibold dark:border-white/20"
              >
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
   Trust, Security & Logos
   ========================= */
function TrustSecurity() {
  return (
    <motion.section
      className="relative overflow-hidden bg-white py-20 dark:bg-gray-950"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Logos / Social proof */}
        <motion.div variants={fadeUp} className="mb-12">
          <LogosMarquee />
        </motion.div>

        <motion.div variants={fadeUp} className="text-center mb-14">
          <h2 className="mb-4 bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-4xl font-extrabold text-transparent">
            Private by Design. Built for Schools.
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-300">
            We keep teacher and student data safe with sensible defaults and clear controls.
          </p>
        </motion.div>

        {/* Trust cards */}
        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          variants={container}
        >
          {[
            { title: "Encryption", desc: "Data encrypted in transit and at rest with modern standards.", icon: "🔒" },
            { title: "Privacy-First", desc: "No ads, no selling data. You control retention and export.", icon: "🛡️" },
            { title: "Reliability", desc: "Monitored uptime and graceful fallbacks during peak load.", icon: "⚡" },
            { title: "Controls", desc: "Role-based access, per-class sharing, and one-click export.", icon: "⚙️" },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              variants={fadeUp}
              transition={{ delay: 0.05 * i }}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-2xl dark:from-sky-900/40 dark:to-indigo-900/40">
                {c.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 d  ark:text-white">{c.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{c.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

/* =========================
   Logos Marquee (replace with real logos later)
   ========================= */
function LogosMarquee() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white dark:from-gray-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white dark:from-gray-900 to-transparent" />
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="flex items-center gap-10 whitespace-nowrap px-6"
      >
        {Array.from({ length: 2 }).flatMap(() => [
          "CHANAKYA INSTITUTE OF EDUCATION", "EDUCATION BEAST", "DEEP COACHING CENTRE",
          "DEEP JYOTI COACHING CENTRE", "ANUPMA INSTITUTE", "DELTA INSTITUTES",
        ]).map((name, idx) => (
          <div
            key={idx}
            className="inline-flex h-10 items-center rounded-md border border-gray-200 px-4 text-xs font-semibold tracking-wider text-gray-600 dark:border-gray-800 dark:text-gray-300"
          >
            {name}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* =========================
   Outcomes & Stats
   ========================= */
function Outcomes() {
  const stats = [
    { k: "2000+", v: "Questions Generated", sub: "across subjects & boards" },
    { k: "5h", v: "Saved / Teacher / Month", sub: "on paper creation & grading" },
    { k: "95%", v: "Teacher Satisfaction", sub: "internal NPS survey" },
  ];

  return (
    <motion.section
      className="bg-gradient-to-b from-gray-50 to-white py-20 dark:from-gray-900 dark:to-gray-950"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mb-12 text-center" variants={fadeUp}>
          <h2 className="mb-3 text-4xl font-extrabold text-gray-900 dark:text-white">
            Outcomes that matter
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-300">
            Less busywork. More teaching time. Better insights for every class.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-6 sm:grid-cols-3"
          variants={container}
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.v}
              variants={fadeUp}
              transition={{ delay: 0.05 * i }}
              className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-[linear-gradient(90deg,#0ea5e9_0%,#6366f1_50%,#a78bfa_100%)]">
                {s.k}
              </div>
              <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{s.v}</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{s.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* subtle CTA */}
        <motion.div
          variants={fadeUp}
          className="mx-auto mt-12 max-w-3xl rounded-2xl border border-gray-200 bg-white/70 p-6 text-center shadow-lg backdrop-blur dark:border-gray-800 dark:bg-white/[0.06]"
        >
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs tracking-wide text-gray-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
            <Sparkles className="h-4 w-4 text-sky-600" />
            Start free — no credit card
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            See how much time you’ll save this week.
          </h3>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Generate your first paper and share it with your class in minutes.
          </p>
          <div className="mt-5">
            <Link to="/signup">
              <Button className="rounded-xl bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-900 px-7 py-6 text-base font-semibold text-white hover:from-slate-800 hover:via-sky-800 hover:to-indigo-800">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
