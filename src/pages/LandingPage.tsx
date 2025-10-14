import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingDemo from "@/components/LandingDemo";
import LandingFeatures from "@/components/LandingFeatures";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer"; 
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, MessageSquare, Download, Settings } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

/* -------------------- Animation presets -------------------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const container = { 
  hidden: {}, 
  show: { transition: { staggerChildren: 0.12 } } 
};

export default function LandingPage() {
  const { session } = useAuth();
  const loggedIn = !!session;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <Navbar />

      <main className="flex-grow">
        {/* HERO */}
        <LandingHero />

        {/* DEMO */}
        <LandingDemo
          videoSrcMp4="/demo.mp4"
          poster="/demo-poster.png"
          showHud
        />

        {/* FEATURES */}
        <LandingFeatures />

        {/* HOW IT WORKS - Simplified */}
        <HowItWorks />

        {/* TRUST & SECURITY */}
        <TrustSecurity />

        {/* OUTCOMES & STATS */}
        <Outcomes />

        {/* TESTIMONIALS */}
        <Testimonials />

        {/* FINAL CTA */}
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

/* =========================
   How It Works - Optimized
   ========================= */
function HowItWorks() {
  const steps = [
    {
      title: "Choose Specifications",
      desc: "Select subject, difficulty, question type, and other parameters.",
      icon: <Settings className="h-6 w-6" />,
    },
    {
      title: "AI Generates Content",
      desc: "Multiple AI models create questions and answers instantly.",
      icon: <MessageSquare className="h-6 w-6" />,
    },
    {
      title: "Download Test Paper",
      desc: "Get professionally formatted PDF/DOCX ready for distribution.",
      icon: <Download className="h-6 w-6" />,
    },
  ];

  return (
    <motion.section
      className="bg-gradient-to-b from-[#F2F5FA] to-white py-16 dark:from-gray-900 dark:to-gray-950"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mb-12 text-center" variants={fadeUp}>
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Create high-quality test papers in three simple steps
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              variants={fadeUp}
              className="relative text-center"
            >
              {/* Step Number */}
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                <span className="text-lg font-bold">{index + 1}</span>
              </div>
              
              {/* Content */}
              <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  {step.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <UpgradedCTA />
      </div>
    </motion.section>
  );
}

/* =========================
   Upgraded CTA - Optimized
   ========================= */
function UpgradedCTA() {
  const { session } = useAuth();
  const loggedIn = !!session;

  return (
    <motion.div variants={fadeUp} className="mx-auto mt-16 max-w-4xl">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white shadow-xl">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4" />
            No credit card required
          </div>

          <h3 className="mb-4 text-2xl font-bold">
            Create Your First Test in Minutes
          </h3>
          <p className="mb-6 text-blue-100">
            Start with a topic or paste your syllabus. We'll generate a fully formatted paper with answer key.
          </p>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["Curriculum-aligned", "Multiple question types", "Instant answer key"].map((feature) => (
              <div key={feature} className="flex items-center justify-center gap-2 text-sm">
                <Check className="h-4 w-4" />
                {feature}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to={loggedIn ? "/dashboard/test-generator" : "/signup"}>
              <Button
                className="bg-white text-blue-600 hover:bg-gray-100"
                size="lg"
              >
                Create Your First Test
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button
                variant="outline"
                className="border-white text-white hover:bg-blue-500"
                size="lg"
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
   Trust & Security - Optimized
   ========================= */
function TrustSecurity() {
  const features = [
    { 
      title: "Encryption", 
      desc: "Data encrypted in transit and at rest with modern standards.", 
      icon: "🔒" 
    },
    { 
      title: "Privacy-First", 
      desc: "No ads, no selling data. You control retention and export.", 
      icon: "🛡️" 
    },
    { 
      title: "Reliability", 
      desc: "Monitored uptime and graceful fallbacks during peak load.", 
      icon: "⚡" 
    },
    { 
      title: "Controls", 
      desc: "Role-based access, per-class sharing, and one-click export.", 
      icon: "⚙️" 
    },
  ];

  return (
    <section className="bg-white py-16 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            Trusted by Educators
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Secure, reliable, and built specifically for educational institutions
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-800"
            >
              <div className="text-2xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================
   Outcomes & Stats - Optimized
   ========================= */
function Outcomes() {
  const stats = [
    { value: "12+", label: "Question Formats", description: "MCQ, SA, LA, Cloze, Match…" },
    { value: "PDF & Word", label: "Export Options", description: "Print or share in your LMS" },
    { value: "Instant", label: "Generation", description: "Get tests in seconds" },
  ];

  return (
    <section className="bg-gray-50 py-16 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            Outcomes That Matter
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Less busywork. More teaching time. Better insights for every class.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stat.value}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {stat.label}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================
   Testimonials - Optimized
   ========================= */
function Testimonials() {
  const testimonials = [
    {
      quote: "a4ai has saved me hours every week. The quality of generated tests is impressive and engaging for students.",
      name: "Rahul Verma",
      role: "Director, Education Beast",
    },
    {
      quote: "Perfect for creating differentiated assessments for my diverse classroom. The variety of question types is excellent.",
      name: "Abhay Gupta",
      role: "Director, Chanakya Institute",
    },
    {
      quote: "Surprised by the accuracy and curriculum-aligned questions. The AI-generated content is remarkably good.",
      name: "Aman Singh",
      role: "Chemistry Teacher (10+ Years Exp)",
    },
  ];

  return (
    <section className="bg-white py-16 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            What Educators Say
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Thousands of teachers trust a4ai to save time and improve student outcomes.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800"
            >
              <div className="mb-4 flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {testimonial.role}
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                "{testimonial.quote}"
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================
   Final CTA - Optimized
   ========================= */
function FinalCTA() {
  return (
    <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-16">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white md:text-4xl">
          Ready to Transform Your Assessment Process?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
          Join thousands of educators saving time and improving outcomes with a4ai.
        </p>
        <div className="mt-8">
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Get Started For Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}