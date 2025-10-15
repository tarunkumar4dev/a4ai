import React, { lazy, Suspense, memo, useMemo } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
// Code-split heavier sections
const LandingDemo = lazy(() => import("@/components/LandingDemo"));
const LandingFeatures = lazy(() => import("@/components/LandingFeatures"));
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer"; 
import { Button } from "@/components/ui/button";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, MessageSquare, Download, Settings } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

/* -------------------- Animation presets (lightweight) -------------------- */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const container = { 
  hidden: {}, 
  show: { transition: { staggerChildren: 0.06 } } 
};

// Static data lifted out to avoid re-creation on renders
const HOW_STEPS = Object.freeze([
  { title: "Choose Specifications", desc: "Select subject, difficulty, question type, and other parameters.", Icon: Settings },
  { title: "AI Generates Content", desc: "Multiple AI models create questions and answers instantly.", Icon: MessageSquare },
  { title: "Download Test Paper", desc: "Get professionally formatted PDF/DOCX ready for distribution.", Icon: Download },
]);

const TRUST_FEATURES = Object.freeze([
  { title: "Encryption", desc: "Data encrypted in transit and at rest with modern standards.", icon: "🔒" },
  { title: "Privacy-First", desc: "No ads, no selling data. You control retention and export.", icon: "🛡️" },
  { title: "Reliability", desc: "Monitored uptime and graceful fallbacks during peak load.", icon: "⚡" },
  { title: "Controls", desc: "Role-based access, per-class sharing, and one-click export.", icon: "⚙️" },
]);

const OUTCOME_STATS = Object.freeze([
  { value: "12+", label: "Question Formats", description: "MCQ, SA, LA, Cloze, Match…" },
  { value: "PDF & Word", label: "Export Options", description: "Print or share in your LMS" },
  { value: "Instant", label: "Generation", description: "Get tests in seconds" },
]);

const TESTIMONIALS = Object.freeze([
  { quote: "a4ai has saved me hours every week. The quality of generated tests is impressive and engaging for students.", name: "Rahul Verma", role: "Director, Education Beast" },
  { quote: "Perfect for creating differentiated assessments for my diverse classroom. The variety of question types is excellent.", name: "Abhay Gupta", role: "Director, Chanakya Institute" },
  { quote: "Surprised by the accuracy and curriculum-aligned questions. The AI-generated content is remarkably good.", name: "Aman Singh", role: "Chemistry Teacher (10+ Years Exp)" },
]);

export default function LandingPage() {
  const { session } = useAuth();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <Navbar />

      <main className="flex-grow">
        {/* HERO (kept non-animated / internal animations inside component) */}
        <LandingHero />

        {/* DEMO (lazy-loaded only when scrolled near) */}
        <Suspense fallback={null}>
          <LandingDemo videoSrcMp4="/demo.mp4" poster="/demo-poster.png" showHud />
        </Suspense>

        {/* FEATURES (lazy-loaded) */}
        <Suspense fallback={null}>
          <LandingFeatures />
        </Suspense>

        {/* Sections with lightweight Framer via LazyMotion */}
        <LazyMotion features={domAnimation} strict>
          <HowItWorks reduceMotion={reduceMotion} />
          <TrustSecurity />
          <Outcomes />
          <Testimonials />
          <FinalCTA />
        </LazyMotion>
      </main>

      <Footer />
    </div>
  );
}

/* =========================
   How It Works — Optimized & memoized
   ========================= */
const HowItWorks = memo(function HowItWorks({ reduceMotion }: { reduceMotion?: boolean }) {
  return (
    <m.section
      className="bg-gradient-to-b from-zinc-50 to-white py-16 dark:from-slate-900 dark:to-slate-950"
      variants={container}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "show"}
      viewport={{ once: true, amount: 0.25 }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div className="mb-12 text-center" variants={fadeUp}>
          <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Create high-quality test papers in three simple steps
          </p>
        </m.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {HOW_STEPS.map(({ title, desc, Icon }, index) => (
            <m.div
              key={title}
              variants={fadeUp}
              className="relative text-center will-change-transform"
            >
              {/* Step Number */}
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="text-lg font-bold">{index + 1}</span>
              </div>

              {/* Content */}
              <div className="rounded-lg bg-white p-6 shadow-lg ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-white/10">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-200 dark:to-slate-300 dark:text-slate-900">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{desc}</p>
              </div>
            </m.div>
          ))}
        </div>

        <UpgradedCTA />
      </div>
    </m.section>
  );
});

/* =========================
   Upgraded CTA — Neutral & light
   ========================= */
const UpgradedCTA = memo(function UpgradedCTA() {
  const { session } = useAuth();
  const loggedIn = !!session;

  return (
    <m.div variants={fadeUp} className="mx-auto mt-16 max-w-4xl will-change-transform">
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-8 shadow-xl ring-1 ring-slate-200/70 dark:from-slate-900 dark:to-slate-950 dark:ring-white/10">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white dark:bg-white/90 dark:text-slate-900">
            <Sparkles className="h-4 w-4" />
            No credit card required
          </div>

          <h3 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Create Your First Test in Minutes</h3>
          <p className="mb-6 text-slate-600 dark:text-slate-300">Start with a topic or paste your syllabus. We'll generate a fully formatted paper with answer key.</p>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["Curriculum-aligned", "Multiple question types", "Instant answer key"].map((feature) => (
              <div key={feature} className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Check className="h-4 w-4" />
                {feature}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to={loggedIn ? "/dashboard/test-generator" : "/signup"}>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" size="lg">
                Create Your First Test
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="outline" className="border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" size="lg">
                Watch Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </m.div>
  );
});

/* =========================
   Trusted by Educators — Neutral greys
   ========================= */
const TrustSecurity = memo(function TrustSecurity() {
  return (
    <section className="bg-white py-16 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Trusted by Educators</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Secure, reliable, and built specifically for educational institutions</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {TRUST_FEATURES.map((feature, index) => (
            <m.div
              key={feature.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg bg-zinc-50 p-6 text-center ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-white/10 will-change-transform"
            >
              <div className="text-2xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{feature.desc}</p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* =========================
   Outcomes & Stats — Neutral greys
   ========================= */
const Outcomes = memo(function Outcomes() {
  return (
    <section className="bg-zinc-50 py-16 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Outcomes That Matter</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Less busywork. More teaching time. Better insights for every class.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {OUTCOME_STATS.map((stat, index) => (
            <m.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.3 }}
              className="text-center will-change-transform"
            >
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">{stat.value}</div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{stat.label}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{stat.description}</p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* =========================
   Testimonials — Neutral greys
   ========================= */
const Testimonials = memo(function Testimonials() {
  return (
    <section className="bg-white py-16 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">What Educators Say</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Thousands of teachers trust a4ai to save time and improve student outcomes.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t, index) => (
            <m.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.3 }}
              className="rounded-lg bg-zinc-50 p-6 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-white/10 will-change-transform"
            >
              <div className="mb-4 flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t.role}</p>
                </div>
              </div>
              <p className="text-slate-700 dark:text-slate-300">"{t.quote}"</p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* =========================
   Final CTA — Neutral hero panel
   ========================= */
const FinalCTA = memo(function FinalCTA() {
  return (
    <section className="bg-gradient-to-r from-zinc-50 to-white py-16 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Ready to Transform Your Assessment Process?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Join thousands of educators saving time and improving outcomes with a4ai.</p>
        <div className="mt-8">
          <Link to="/signup">
            <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
              Get Started For Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
});