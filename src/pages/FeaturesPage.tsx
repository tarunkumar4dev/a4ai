import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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

const FeaturesPage = () => {
  const features = [
    {
      title: "AI-Powered Test Generation",
      description: "Create customized tests in minutes with our advanced AI algorithms",
      icon: "🧠"
    },
    {
      title: "Curriculum-Aligned Content",
      description: "Questions automatically aligned with educational standards",
      icon: "📚"
    },
    {
      title: "Multiple Question Types",
      description: "MCQs, short answer, essays, and more - all automatically generated",
      icon: "✏️"
    },
    {
      title: "Difficulty Customization",
      description: "Adjust difficulty levels to match your students' needs",
      icon: "📊"
    },
    {
      title: "Instant Answer Keys",
      description: "Automatically generated answer keys with explanations",
      icon: "🔑"
    },
    {
      title: "Collaborative Features",
      description: "Share and collaborate on test creation with colleagues",
      icon: "👥"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text mb-4">
              Powerful Features
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need to create perfect assessments in half the time
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
                  <CardHeader className="flex items-center space-x-4">
                    <div className="text-3xl">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {feature.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-16">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 text-lg"
            >
              Start Creating Tests
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
              Trusted by 8,000+ Educators
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Join educators who are transforming their assessment process
            </p>
          </div>
          
          {/* Testimonial cards would go here */}
        </div>
      </section>
    </div>
  );
};

export default FeaturesPage;