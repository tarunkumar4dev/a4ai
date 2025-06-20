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
      className="relative bg-gradient-to-br from-[#f8fafc] to-white py-16 md:py-24 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic gradient background */}
      <motion.div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: useMotionTemplate`radial-gradient(400px at ${mouseX}px ${mouseY}px, rgba(99, 102, 241, 0.1), transparent 70%)`
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          {/* AI-Powered Education Tech Badge - Kept as requested */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-6"
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-600">AI-Powered Education Technology</span>
          </motion.div>

          {/* Compact headline section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
            >
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent text-4xl md:text-6xl lg:text-7xl">
                Smartest Test Generator Platform
              </span>
              <br className="hidden md:inline" />
              <span className="text-gray-900"> Made for the Excellence</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 md:mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto"
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
                className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="group border-gray-300 hover:border-indigo-300"
              >
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Live Demo
                </span>
              </Button>
            </Link>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm"
          >
            <div className="flex items-center gap-2">
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
                  />
                ))}
              </div>
              <span className="text-gray-600">Trusted by 8,000+ educators</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.svg
                    key={star}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.7 + star * 0.05 }}
                    className="w-4 h-4 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </motion.svg>
                ))}
              </div>
              <span className="text-gray-600">4.9/5 (200+ reviews)</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Animated border */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
      />
    </div>
  );
};

export default LandingHero;


