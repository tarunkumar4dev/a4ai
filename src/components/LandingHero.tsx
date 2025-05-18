
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const LandingHero = () => {
  return (
    <div className="bg-zolvio-light-bg py-12 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-zolvio-purple mb-6 animate-fade-in">
            The Smartest Test Generator
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8">
            Leverage the power of multiple AI models to create{" "}
            <span className="text-zolvio-purple font-semibold">high-quality, customized test papers</span>{" "}
            that save teachers time while improving student outcomes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-zolvio-purple hover:bg-zolvio-purple-hover w-full sm:w-auto">
                Get Started - It's Free
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                See Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingHero;
