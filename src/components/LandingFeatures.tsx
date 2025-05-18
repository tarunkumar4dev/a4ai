
import { FileText, Brain, Loader, Target } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "10,000+ Generated Tests",
    description: "Teachers have already created thousands of customized tests with our platform."
  },
  {
    icon: Brain,
    title: "4+ AI Models",
    description: "Leveraging multiple AI models ensures the highest quality and accuracy for your tests."
  },
  {
    icon: Target,
    title: "99% Accuracy",
    description: "Our keyword density algorithm ensures questions and answers are accurate and reliable."
  },
  {
    icon: Loader,
    title: "Fast Generation",
    description: "Create complete test papers in minutes, not hours. Save time for what matters most."
  }
];

const LandingFeatures = () => {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 rounded-lg">
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-zolvio-light-bg mb-4">
                <feature.icon className="h-8 w-8 text-zolvio-purple" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
