import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Moon, Sun, Globe, Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [activeLink, setActiveLink] = useState("Home");

  // Cluely-inspired color palette
  const colors = {
    light: {
      primary: "#2563eb",     // Vibrant blue (Cluely's primary)
      secondary: "#3b82f6",   // Slightly lighter blue
      accent: "#1d4ed8",      // Darker blue for hover states
      background: "#ffffff",
      text: "#1f2937",
      muted: "#6b7280",
      border: "#e5e7eb"
    },
    dark: {
      primary: "#60a5fa",     // Brighter blue for dark mode
      secondary: "#3b82f6",   
      accent: "#1d4ed8",      
      background: "#111827",
      text: "#f9fafb",
      muted: "#9ca3af",
      border: "#374151"
    }
  };

  const currentColors = theme === "dark" ? colors.dark : colors.light;

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Features", path: "/features" },
    { name: "Pricing", path: "/pricing" },
    { name: "Resources", path: "/resources" },
    { name: "About", path: "/about" }
  ];

  return (
    <nav 
      className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center group"
            onClick={() => setActiveLink("Home")}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2"
            >
              <img 
                src="/ICON.ico" 
                alt="a4ai logo" 
                className="h-8 w-8"
              />
              <motion.span 
                className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                a4ai
              </motion.span>
              <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full ml-2">
                βeta
              </span>
            </motion.div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="relative px-3 py-2 group"
                onClick={() => setActiveLink(item.name)}
              >
                <motion.span
                  className={`text-sm font-medium transition-colors ${
                    activeLink === item.name 
                      ? `text-blue-600 dark:text-blue-400` 
                      : `text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white`
                  }`}
                  whileHover={{ 
                    color: theme === "dark" ? "#ffffff" : "#111827"
                  }}
                >
                  {item.name}
                </motion.span>
                
                <AnimatePresence>
                  {activeLink === item.name && (
                    <motion.span
                      className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-blue-600 to-blue-500"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      exit={{ scaleX: 0 }}
                      transition={{ duration: 0.3 }}
                      layoutId="activeIndicator"
                    />
                  )}
                </AnimatePresence>
              </Link>
            ))}
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            {/* Search Button */}
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
            >
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>
              
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 200 }}
                    exit={{ opacity: 0, width: 0 }}
                    className="absolute right-0 top-0 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <input
                      type="text"
                      placeholder="Search a4ai..."
                      className="w-full h-10 px-4 bg-transparent text-sm focus:outline-none text-gray-900 dark:text-white"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Language Selector */}
            <motion.div 
              className="relative group"
              whileHover={{ scale: 1.05 }}
            >
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                aria-label="Language"
              >
                <Globe className="h-5 w-5" />
              </Button>
              <div className="absolute right-0 mt-2 w-40 origin-top-right bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
                {['English', 'Español', 'Français', 'Deutsch'].map((lang) => (
                  <button 
                    key={lang}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Dark Mode Toggle */}
            <motion.div whileHover={{ scale: 1.05 }}>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </motion.div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              <Link to="/login">
                <motion.div whileHover={{ scale: 1.03 }}>
                  <Button 
                    variant="ghost"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                  >
                    Sign in
                  </Button>
                </motion.div>
              </Link>
              <Link to="/signup">
                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-sm hover:shadow-md transition-all"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-600 dark:text-gray-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden"
          >
            <div className="px-2 pt-2 pb-4 space-y-1 border-t border-gray-200 dark:border-gray-800">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    activeLink === item.name 
                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => {
                    setActiveLink(item.name);
                    setMobileMenuOpen(false);
                  }}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <Link to="/login" className="block w-full px-4 py-2 text-left">
                  <Button variant="outline" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup" className="block w-full px-4 py-2 text-left mt-2">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-500">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;