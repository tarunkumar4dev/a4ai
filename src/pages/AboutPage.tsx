import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
            About a4ai
          </h1>
          <p className="text-xl max-w-3xl mx-auto">
            Revolutionizing education through AI-powered assessment tools
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                We believe every educator should have access to high-quality assessment tools that save time while improving student outcomes.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Founded in April 2025, a4ai combines cutting-edge AI with deep educational expertise to create the smartest test generation platform available.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
            >
              <img 
                src="/images/bg.jpg" 
                alt="Team working together" 
                className="rounded-lg w-full h-auto"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
              Meet The Team
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              The brilliant minds behind a4ai
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <motion.div 
                key={index}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={member.image} alt={member.name} />
                  <AvatarFallback className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-2xl">
                    {member.name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-purple-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 dark:text-gray-300">
                  {member.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;