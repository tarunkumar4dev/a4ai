import { FileText, Brain, Loader, Target } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "10,000+ Generated Tests",
    description: "Teachers have already created thousands of customized tests with our platform.",
  },
  {
    icon: Brain,
    title: "4+ AI Models",
    description: "Leveraging multiple AI models ensures the highest quality and accuracy for your tests.",
  },
  {
    icon: Target,
    title: "99% Accuracy",
    description: "Our keyword density algorithm ensures questions and answers are accurate and reliable.",
  },
  {
    icon: Loader,
    title: "Fast Generation",
    description: "Create complete test papers in minutes, not hours. Save time for what matters most.",
  },
];

const LandingFeatures = () => {
  return (
    <section className="py-20 bg-[#f8f9fa]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl p-6 flex flex-col items-center text-center border border-gray-100"
            >
              <div className="h-14 w-14 flex items-center justify-center rounded-lg bg-[#e9ecef] mb-4">
                <feature.icon className="h-7 w-7 text-[#6f42c1]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-700">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
