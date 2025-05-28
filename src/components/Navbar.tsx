import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex"
          >
            <Link to="/" className="flex items-center group">
              <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-zolvio-purple to-zolvio-blue bg-clip-text text-transparent transition-all duration-300 group-hover:scale-105">
                a4ai
              </span>
            </Link>
          </motion.div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {[
              { name: "Features", path: "/features" },
              { name: "Pricing", path: "/pricing" },
              { name: "About", path: "/about" },
            ].map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Link
                  to={item.path}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 relative group"
                >
                  {item.name}
                  <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-zolvio-purple transition-all duration-300 group-hover:w-3/4 group-hover:left-1/4"></span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Auth Buttons */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center space-x-2"
          >
            <Link to="/login">
              <Button 
                variant="ghost" 
                className="hidden md:block text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-gradient-to-r from-zolvio-purple to-zolvio-blue hover:from-zolvio-purple-hover hover:to-zolvio-blue-hover text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                Get Started
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;