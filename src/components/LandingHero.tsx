import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Zap, Check, BookOpen, BarChart2 } from "lucide-react";
import { useInView } from "react-intersection-observer";

const LandingHero = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const x20 = useTransform(mouseX, (v) => v / 20);
  const y20 = useTransform(mouseY, (v) => v / 20);
  const x30 = useTransform(mouseX, (v) => v / 30);
  const y30 = useTransform(mouseY, (v) => v / 30);
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: false
  });

  const handleMouseMove = ({ clientX, clientY, currentTarget }: React.MouseEvent) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  // Floating features animation
  const floatingFeatures = [
    { icon: <Zap className="h-5 w-5" />, text: "AI-Powered" },
    { icon: <BookOpen className="h-5 w-5" />, text: "Curriculum-Aligned" },
    { icon: <BarChart2 className="h-5 w-5" />, text: "Real Analytics" },
    { icon: <Check className="h-5 w-5" />, text: "Instant Generation" }
  ];

  return (
    <div
      ref={ref}
      className="relative bg-gradient-to-br from-[#f8fafc] to-white dark:from-gray-950 dark:to-gray-900 py-16 md:py-32 overflow-hidden group isolate"
      onMouseMove={handleMouseMove}
    >
      {/* Advanced 3D gradient background */}
      <motion.div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              800px at ${mouseX}px ${mouseY}px,
              rgba(99, 102, 241, 0.15),
              transparent 80%
            )
          `,
          transform: "translateZ(0)"
        }}
        animate={{
          opacity: inView ? 0.2 : 0
        }}
        transition={{
          duration: 1.5,
          ease: "easeOut"
        }}
      />

      {/* Dynamic grid overlay with parallax effect */}
      <motion.div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M0 0l60 60m0-60L0 60' stroke='%232563eb' stroke-width='0.5'/%3E%3C/svg%3E")`,
          transform: useMotionTemplate`translate(${x20}px, ${y20}px)`
        }}
      />

      {/* Floating particles animation */}
      <AnimatePresence>
        {inView && (
          <>
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-indigo-500/10 pointer-events-none"
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: Math.random() * 100 - 50,
                  y: Math.random() * 100 - 50
                }}
                animate={{
                  opacity: [0, 0.3, 0],
                  scale: [0, 1, 0],
                  x: [
                    Math.random() * 100 - 50,
                    Math.random() * 200 - 100,
                    Math.random() * 300 - 150
                  ],
                  y: [
                    Math.random() * 100 - 50,
                    Math.random() * 200 - 100,
                    Math.random() * 300 - 150
                  ]
                }}
                transition={{
                  duration: 5 + Math.random() * 10,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 5
                }}
                style={{
                  width: `${2 + Math.random() * 4}px`,
                  height: `${2 + Math.random() * 4}px`
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          {/* Premium badge with floating animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm mb-8 hover:shadow-md transition-all duration-300 group/badge relative overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 opacity-0 group-hover/badge:opacity-100 transition-opacity duration-500"
              style={{
                transform: useMotionTemplate`translate(${x30}px, ${y30}px)`
              }}
            />
            <motion.div
              className="relative z-10 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                <Sparkles className="h-5 w-5 text-indigo-600" />
              </motion.div>
              <span className="text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Think Beyond
              </span>
            </motion.div>
          </motion.div>

          {/* Main headline with advanced effects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mb-10 md:mb-14"
          >
            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight"
              style={{
                textShadow: "0 4px 12px rgba(99, 102, 241, 0.1)"
              }}
            >
              <motion.span
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent inline-block"
                animate={inView ? {
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                } : {}}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{
                  backgroundSize: "200% 200%"
                }}
              >
                Smartest. Tests. Ever.
              </motion.span>
              <br className="hidden md:inline" />
              <motion.span
                className="text-gray-900 inline-block mt-2 md:mt-4"
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.3 }
                }}
              >
                The Teacher's Assessment Co-Pilot
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5 }}
              className="mt-6 md:mt-8 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Generate & Host curriculum-perfect tests in 2 minutes.
            </motion.p>
          </motion.div>

          {/* Floating feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {floatingFeatures.map((feature, index) => (
              <motion.div
                key={feature.text}
                className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -3 }}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <motion.div
                  animate={{
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: index * 0.2
                  }}
                >
                  {feature.icon}
                </motion.div>
                <span className="text-sm font-medium text-gray-700">
                  {feature.text}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Enhanced CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
          >
            <Link to="/signup">
              <Button
                size="lg"
                className="group/button relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6"
              >
                <span className="relative z-10 flex items-center text-lg font-semibold">
                  Get Started Free
                  <motion.div
                    className="ml-3"
                    animate={{
                      x: [0, 4, 0],
                      transition: {
                        duration: 1.5,
                        repeat: Infinity
                      }
                    }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </motion.div>
                </span>
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-purple-700 opacity-0 group-hover/button:opacity-100 transition-opacity duration-500"
                  initial={{ x: -100 }}
                  animate={{
                    x: ["-100%", "100%"],
                    transition: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }
                  }}
                />
              </Button>
            </Link>
            <Link to="/demo">
              <Button
                variant="outline"
                size="lg"
                className="group/outline border-gray-300 hover:border-indigo-300 hover:bg-white/90 transition-all duration-300 shadow-sm hover:shadow-md px-8 py-6"
              >
                <span className="relative z-10 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover/outline:from-indigo-700 group-hover/outline:to-purple-700 transition-all duration-300">
                  Watch Demo
                </span>
                <motion.span
                  className="absolute inset-0 rounded-lg border border-indigo-200 opacity-0 group-hover/outline:opacity-100 transition-opacity duration-500"
                  style={{
                    background: useMotionTemplate`radial-gradient(100px at ${mouseX}px ${mouseY}px, rgba(99, 102, 241, 0.1), transparent 80%)`
                  }}
                />
              </Button>
            </Link>
          </motion.div>

          {/* Premium Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 1 }}
            className="flex flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Animated user avatars */}
              <motion.div
                className="flex -space-x-3"
                whileHover={{ scale: 1.05 }}
              >
                {[1, 2, 3, 4].map((item) => (
                  <motion.div
                    key={item}
                    initial={{ scale: 0, rotate: -45 }}
                    animate={inView ? { scale: 1, rotate: 0 } : {}}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                      delay: 1.1 + item * 0.1
                    }}
                    whileHover={{ y: -5, zIndex: 1 }}
                    className="relative"
                  >
                    <img
                      src={`https://randomuser.me/api/portraits/${item % 2 === 0 ? 'women' : 'men'}/${item + 20}.jpg`}
                      className="w-12 h-12 rounded-full border-2 border-white shadow-md hover:shadow-lg transition-all"
                      alt="User"
                    />
                    {item === 1 && (
                      <motion.div
                        className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 shadow-md"
                        initial={{ scale: 0 }}
                        animate={inView ? { scale: 1 } : {}}
                        transition={{ delay: 1.5 }}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>

              <div className="text-center sm:text-left">
                <motion.p
                  className="text-gray-600 text-sm"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.3 }}
                >
                  Trusted by educators at
                </motion.p>
                <motion.div
                  className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 mt-2"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.4 }}
                >
                  {["Chanakya Institute", "Deep Coaching ", "Education Beast", "DeepJyoti Coaching"].map((item, index) => (
                    <motion.span
                      key={item}
                      className="text-gray-800 font-medium"
                      whileHover={{ color: "#6366f1" }}
                      initial={{ opacity: 0, y: 5 }}
                      animate={inView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.3, delay: 1.5 + index * 0.1 }}
                    >
                      {item}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Rating with animated stars */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.6 }}
            >
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.svg
                    key={star}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={inView ? { scale: 1, rotate: 0 } : {}}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                      delay: 1.7 + star * 0.1
                    }}
                    className="w-5 h-5 text-amber-400 hover:text-amber-500 transition-colors"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    whileHover={{ scale: 1.3 }}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </motion.svg>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 1.9 }}
                className="text-gray-700 font-medium"
              >
                4.6/5 (700+ reviews)
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Advanced animated border */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{
          scaleX: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.5 }
        }}
      />

      {/* Subtle floating shapes in background */}
      <AnimatePresence>
        {inView && (
          <>
            <motion.div
              className="absolute hidden lg:block left-10 top-1/4 w-32 h-32 rounded-full bg-indigo-500/10 blur-xl pointer-events-none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0.1, 0.2, 0.1],
                scale: [1, 1.1, 1],
                y: [-20, 20, -20]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute hidden lg:block right-20 top-1/3 w-24 h-24 rounded-full bg-purple-500/10 blur-xl pointer-events-none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0.1, 0.15, 0.1],
                scale: [1, 1.05, 1],
                y: [10, -10, 10]
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingHero;