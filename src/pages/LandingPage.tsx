import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingFeatures from "@/components/LandingFeatures";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <LandingHero />
        <LandingFeatures />

        {/* How It Works Section */}
        <motion.section
          className="py-16 bg-gray-50"
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Our AI-powered system creates high-quality test papers in just a few simple steps.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "Choose Your Specifications",
                  desc: "Select subject, difficulty, question type, and other parameters for your test.",
                },
                {
                  title: "AI Models Generate Content",
                  desc: "Multiple AI models create questions and answers based on your specifications.",
                },
                {
                  title: "Download Your Test Paper",
                  desc: "Get your professionally formatted test paper ready for distribution.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.03] transition duration-300"
                  variants={fadeInUp}
                >
                  <div className="w-12 h-12 bg-zolvio-purple rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div className="text-center mt-12" variants={fadeInUp}>
              <Button className="bg-zolvio-purple hover:bg-zolvio-purple-hover transition-all scale-100 hover:scale-105">
                Create Your First Test
              </Button>
            </motion.div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          className="py-16 bg-white"
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">What Educators Say</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Thousands of teachers trust Zolvio.ai to save time and improve student outcomes.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "Zolvio.ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging.",
                  name: "Sarah Johnson",
                  title: "High School Science Teacher",
                },
                {
                  quote:
                    "The variety of question types and difficulty levels makes this perfect for creating differentiated assessments for my diverse classroom.",
                  name: "David Martinez",
                  title: "Middle School Math Teacher",
                },
                {
                  quote:
                    "I was skeptical about AI-generated content, but Zolvio.ai surprised me with its accuracy and thoughtful questions aligned with curriculum standards.",
                  name: "Jennifer Lee",
                  title: "University Professor",
                },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition duration-300"
                  variants={fadeInUp}
                >
                  <p className="text-gray-600 mb-4">"{t.quote}"</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-zolvio-purple rounded-full mr-3 animate-pulse"></div>
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-sm text-gray-500">{t.title}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="py-16 bg-zolvio-purple"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Ready to Transform Your Assessment Process?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Join thousands of educators who are saving time and improving student outcomes with Zolvio.ai.
            </p>
            <Button size="lg" className="bg-white text-zolvio-purple hover:bg-gray-100 scale-100 hover:scale-105 transition">
              Get Started For Free
            </Button>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
