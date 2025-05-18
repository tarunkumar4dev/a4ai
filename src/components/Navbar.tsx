
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex">
            <Link to="/" className="flex items-center">
              <span className="text-xl md:text-2xl font-extrabold logo">Zolvio.ai</span>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-4 md:space-x-6">
            <Link to="/features" className="text-gray-600 hover:text-gray-900 px-3 py-2">Features</Link>
            <Link to="/pricing" className="text-gray-600 hover:text-gray-900 px-3 py-2">Pricing</Link>
            <Link to="/about" className="text-gray-600 hover:text-gray-900 px-3 py-2">About</Link>
          </div>
          <div className="flex items-center space-x-2">
            <Link to="/login">
              <Button variant="ghost" className="hidden md:block">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-zolvio-purple hover:bg-zolvio-purple-hover">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
