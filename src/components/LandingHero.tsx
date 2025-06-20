import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

const LandingHero = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({ clientX, clientY, currentTarget }: React.MouseEvent) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  return (
    <div
      className="relative bg-gradient-to-br from-[#f8fafc] to-white py-16 md:py-24 overflow-hidden group"
      onMouseMove={handleMouseMove}
    >
      {/* Modern hover effect layer */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: useMotionTemplate`radial-gradient(600px at ${mouseX}px ${mouseY}px, rgba(99, 102, 241, 0.1), transparent 80%)`
        }}
      />

      {/* Dynamic gradient background */}
      <motion.div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: useMotionTemplate`radial-gradient(400px at ${mouseX}px ${mouseY}px, rgba(99, 102, 241, 0.1), transparent 70%)`
        }}
      />

      {/* Subtle grid overlay for modern look */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGwyMCAyME0yMCAwTDAgMjAiIHN0cm9rZT0icmdiYSg5OSwxMDIsMjQxLDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          {/* AI-Powered Education Tech Badge with hover effect */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-6 hover:bg-indigo-100 hover:border-indigo-200 transition-colors duration-300 group/badge"
          >
            <motion.div 
              className="group-hover/badge:rotate-180 transition-transform duration-500"
              whileHover={{ scale: 1.2 }}
            >
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </motion.div>
            <span className="text-sm font-medium text-indigo-600">AI-Powered Education Technology</span>
          </motion.div>

          {/* Compact headline section with hover scaling */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 group/headline"
          >
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
            >
              <motion.span 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent text-4xl md:text-6xl lg:text-7xl inline-block group-hover/headline:scale-[1.02] transition-transform duration-500"
                whileHover={{ scale: 1.03 }}
              >
                Smartest Test Generator Platform
              </motion.span>
              <br className="hidden md:inline" />
              <motion.span 
                className="text-gray-900 inline-block group-hover/headline:scale-[1.02] transition-transform duration-500"
                whileHover={{ scale: 1.03 }}
              >
                Made for the Excellence
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 md:mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto group-hover:text-gray-700 transition-colors duration-500"
            >
              Revolutionizing your assessment process with our AI-powered platform that creates curriculum-aligned tests in minutes.
            </motion.p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center gap-3 mb-12"
          >
            <Link to="/signup">
              <Button
                size="lg"
                className="group/button relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 group-hover/button:translate-x-1 transition-transform" />
                </span>
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-purple-700 opacity-0 group-hover/button:opacity-100 transition-opacity"
                  initial={{ x: -100 }}
                  animate={{ x: 100 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
              </Button>
            </Link>
            <Link to="/demo">
              <Button
                variant="outline"
                size="lg"
                className="group/outline border-gray-300 hover:border-indigo-300 hover:bg-gray-50/50 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover/outline:bg-gradient-to-r group-hover/outline:from-indigo-700 group-hover/outline:to-purple-700 transition-all duration-300">
                  Live Demo
                </span>
              </Button>
            </Link>
          </motion.div>

          {/* Social Proof with hover effects */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm group/social"
          >
            <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-300">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((item) => (
                  <motion.img
                    key={item}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6 + item * 0.1 }}
                    src={`https://randomuser.me/api/portraits/${item % 2 === 0 ? 'women' : 'men'}/${item + 20}.jpg`}
                    className="w-8 h-8 rounded-full border-2 border-white hover:scale-110 transition-transform"
                    alt="User"
                    whileHover={{ zIndex: 1, scale: 1.2 }}
                  />
                ))}
              </div>
              <span className="text-gray-600 group-hover/social:text-gray-800 transition-colors duration-300">Trusted by Parents & Educators</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-300 group-hover/social:h-8 transition-all duration-300"></div>
            <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-300">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.svg
                    key={star}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.7 + star * 0.05 }}
                    className="w-4 h-4 text-amber-400 hover:text-amber-500 transition-colors duration-300"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    whileHover={{ scale: 1.3 }}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </motion.svg>
                ))}
              </div>
              <span className="text-gray-600 group-hover/social:text-gray-800 transition-colors duration-300">4.9/5 (500+ reviews)</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Animated border with hover effect */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent group-hover:via-purple-500 transition-all duration-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
      />
    </div>
  );
};

export default LandingHero;