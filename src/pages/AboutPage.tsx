import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Helmet } from "react-helmet"; // For SEO in Vite/React projects

const AboutPage = () => {
  const team = [
    {
      name: "Tarun",
      role: "CEO",
      description: "Visionary leader with 10+ years in education technology",
      image: "/images/tarun_a4ai.jpeg"
    },
    {
      name: "Yash",
      role: "CTO",
      description: "Tech expert specializing in AI and machine learning",
      image: "/images/yash_a4ai.jpeg"
    },
    {
      name: "Aakash",
      role: "CMO",
      description: "Marketing strategist connecting with educators",
      image: "/images/aakash_a4ai.jpg"
    },
    {
      name: "Krishna",
      role: "COO",
      description: "Operations specialist ensuring seamless experiences",
      image: "/images/krishna_a4ai.jpg"
    }
  ];

  return (
    <>
      <Helmet>
        <title>About a4ai - Revolutionizing Education with AI</title>
        <meta name="description" content="Learn about a4ai's mission and the team behind our AI-powered education assessment tools" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-gray-50/50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950">
        {/* Hero Section */}
        <section className="relative py-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center opacity-10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.h1 
              className="text-5xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              About a4ai
            </motion.h1>
            <motion.p 
              className="text-xl md:text-2xl max-w-3xl mx-auto font-medium text-purple-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Revolutionizing education through AI-powered assessment tools
            </motion.p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-20 relative">
          <div className="absolute -top-32 left-0 right-0 h-32 bg-gradient-to-b from-indigo-600/10 to-transparent dark:from-purple-600/10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  Our Mission
                </h2>
                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  We believe every educator should have access to high-quality assessment tools that save time while improving student outcomes.
                </p>
                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                  Founded in April 2025, a4ai combines cutting-edge AI with deep educational expertise to create the smartest test generation platform available.
                </p>
                <div className="mt-8">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30"
                  >
                    Learn More About Our Technology
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, margin: "-100px" }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-20 blur-lg" />
                <div className="relative bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-2xl overflow-hidden">
                  <img 
                    src="/images/bg.jpg" 
                    alt="Team working together" 
                    className="rounded-xl w-full h-auto object-cover aspect-video"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 relative">
          <div className="absolute inset-0 bg-[url('/images/grid-dark.svg')] bg-center opacity-5 dark:opacity-[0.02]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center mb-16">
              <motion.h2 
                className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                Meet The Team
              </motion.h2>
              <motion.p 
                className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                viewport={{ once: true }}
              >
                The brilliant minds behind a4ai
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <motion.div 
                  key={index}
                  className="group relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-center border border-gray-100 dark:border-gray-700 hover:border-transparent hover:bg-gradient-to-br from-white/80 via-white to-white/80 dark:from-gray-800/80 dark:via-gray-800 dark:to-gray-800/80"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  whileHover={{ y: -5 }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-100/50 to-purple-100/50 dark:from-indigo-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <Avatar className="h-28 w-28 mx-auto mb-4 group-hover:scale-105 transition-transform duration-300 border-4 border-white/10 group-hover:border-indigo-200/30 dark:border-gray-700 dark:group-hover:border-indigo-500/30">
                      <AvatarImage src={member.image} alt={member.name} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-3xl font-bold">
                        {member.name.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {member.name}
                    </h3>
                    <p className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 font-medium mb-3">
                      {member.role}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {member.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2 
              className="text-3xl md:text-4xl font-extrabold mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Ready to transform your assessments?
            </motion.h2>
            <motion.p 
              className="text-xl max-w-3xl mx-auto mb-8 text-indigo-100"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              viewport={{ once: true }}
            >
              Join thousands of educators using a4ai to save time and improve learning outcomes.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Button 
                size="lg" 
                className="bg-white text-indigo-600 hover:bg-white/90 hover:text-indigo-700 text-lg font-semibold shadow-lg hover:shadow-white/20 px-8 py-6 rounded-xl"
              >
                Get Started for Free
              </Button>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;