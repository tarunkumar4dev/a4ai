
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold text-zolvio-purple mb-4">404</h1>
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Page not found</h2>
      <p className="text-lg text-gray-600 mb-8 max-w-md">
        Sorry, we couldn't find the page you're looking for.
      </p>
      <Link to="/">
        <Button className="bg-zolvio-purple hover:bg-zolvio-purple-hover">
          Return to Home
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
