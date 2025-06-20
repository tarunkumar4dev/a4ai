import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingFeatures from "@/components/LandingFeatures";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
  const founders = [
    {
      name: "Tarun",
      role: "Co-Founder, CEO",
      description: "Visionary leader driving company strategy and growth",
      initials: "TA",
      image: "/images/tarun.jpg"
    },
    {
      name: "Yash",
      role: "Co-Founder, CTO",
      description: "Tech innovator building our cutting-edge platform",
      initials: "YA",
      image: "/images/yash.jpg"
    },
    {
      name: "Aakash",
      role: "Co-Founder, Market Head",
      description: "Marketing expert connecting us with our audience",
      initials: "AK",
      image: "/images/aakash.jpg"
    },
    {
      name: "Krishna",
      role: "Co-Founder, Operations Lead",
      description: "Operations maestro ensuring everything runs smoothly",
      initials: "KR",
      image: "/images/krishna.jpg"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <LandingHero />
        <LandingFeatures />

        {/* How It Works Section */}
        <motion.section
          className="py-16 bg-gray-50 dark:bg-gray-900"
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
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
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.03] transition duration-300"
                  variants={fadeInUp}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 dark:text-white">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div className="text-center mt-12" variants={fadeInUp}>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all scale-100 hover:scale-105">
                Create Your First Test
              </Button>
            </motion.div>
          </div>
        </motion.section>

        {/* Team Section */}
        <motion.section
          className="py-16 bg-white dark:bg-gray-950"
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">
                Meet Our Team
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                The minds behind a4ai
              </p>
            </motion.div>
            
            <motion.div 
              className="grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-4"
              variants={stagger}
            >
              {founders.map((person) => (
                <motion.div key={person.name} variants={fadeInUp}>
                  <Card className="group relative transition-all hover:shadow-lg hover:-translate-y-1 h-full">
                    <CardHeader className="flex items-center justify-center pt-8">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={person.image} alt={person.name} />
                        <AvatarFallback className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-2xl font-medium">
                          {person.initials}
                        </AvatarFallback>
                      </Avatar>
                    </CardHeader>
                    <CardContent className="text-center pb-8">
                      <h3 className="text-lg font-semibold leading-7 tracking-tight text-gray-900 dark:text-white">
                        {person.name}
                      </h3>
                      <p className="text-sm font-medium text-purple-600">
                        {person.role}
                      </p>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {person.description}
                      </p>
                      <div className="mt-4 flex justify-center space-x-4">
                        <a href="#" className="text-gray-400 hover:text-purple-600">
                          <span className="sr-only">LinkedIn</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                          </svg>
                        </a>
                        <a href="#" className="text-gray-400 hover:text-purple-600">
                          <span className="sr-only">Twitter</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                          </svg>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          className="py-16 bg-gray-50 dark:bg-gray-900"
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">What Educators Say</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Thousands of teachers trust a4ai to save time and improve student outcomes.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "a4ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging.",
                  name: "Rahul Verma",
                  title: "Director, Education Beast",
                },
                {
                  quote:
                    "a4ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging.",
                  name: "Abhay Gupta",
                  title: "Director, Chanakya Institute of Education",
                },
                {
                  quote:
                    "a4ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging.",
                  name: "Aman Singh",
                  title: "10+ Years Experience as Chemistry Teacher",
                },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg hover:shadow-md transition duration-300"
                  variants={fadeInUp}
                >
                  <p className="text-gray-600 dark:text-gray-300 mb-4">"{t.quote}"</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mr-3 animate-pulse"></div>
                    <div>
                      <p className="font-semibold dark:text-white">{t.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t.title}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600"
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
              Join thousands of educators who are saving time and improving student outcomes with a4ai.
            </p>
            <Button 
              size="lg" 
              className="bg-white text-indigo-600 hover:bg-gray-100 scale-100 hover:scale-105 transition"
            >
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