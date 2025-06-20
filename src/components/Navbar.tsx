import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Moon, Globe } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2"
            >
              <img 
                src="/ICON.ico" 
                alt="a4ai logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                a4ai
              </span>
            </motion.div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {[
              { name: "Home", path: "/" },
              { name: "Features", path: "/features" },
              { name: "About", path: "/about" },
              { name: "Contact", path: "/contact" },
            ].map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="relative px-1 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 origin-left scale-x-0 hover:scale-x-100 transition-transform duration-300" />
              </Link>
            ))}
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-4">
            {/* Search Button (expandable to full search bar later) */}
            <Button 
              variant="ghost" 
              size="icon"
              className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Language Selector */}
            <div className="relative group">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Globe className="h-5 w-5" />
              </Button>
              <div className="absolute right-0 mt-2 w-40 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100 dark:border-gray-700">
                {['English', 'Spanish', 'French'].map((lang) => (
                  <button key={lang} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <Button 
              variant="ghost" 
              size="icon"
              className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Moon className="h-5 w-5" />
            </Button>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login">
                <Button 
                  variant="ghost" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Log in
                </Button>
              </Link>
              <Link to="/signup">
                <Button 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow hover:shadow-md transition-all"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;