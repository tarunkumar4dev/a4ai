
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import LandingFeatures from "@/components/LandingFeatures";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <LandingHero />
        <LandingFeatures />
        
        {/* How It Works Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Our AI-powered system creates high-quality test papers in just a few simple steps.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-zolvio-purple rounded-full flex items-center justify-center text-white font-bold mb-4">1</div>
                <h3 className="text-xl font-bold mb-2">Choose Your Specifications</h3>
                <p className="text-gray-600">
                  Select subject, difficulty, question type, and other parameters for your test.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-zolvio-purple rounded-full flex items-center justify-center text-white font-bold mb-4">2</div>
                <h3 className="text-xl font-bold mb-2">AI Models Generate Content</h3>
                <p className="text-gray-600">
                  Multiple AI models create questions and answers based on your specifications.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-zolvio-purple rounded-full flex items-center justify-center text-white font-bold mb-4">3</div>
                <h3 className="text-xl font-bold mb-2">Download Your Test Paper</h3>
                <p className="text-gray-600">
                  Get your professionally formatted test paper ready for distribution.
                </p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <Button className="bg-zolvio-purple hover:bg-zolvio-purple-hover">
                Create Your First Test
              </Button>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">What Educators Say</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Thousands of teachers trust Zolvio.ai to save time and improve student outcomes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-600 mb-4">
                  "Zolvio.ai has saved me hours every week. The quality of the generated tests is impressive, and my students find them engaging."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-zolvio-purple rounded-full mr-3"></div>
                  <div>
                    <p className="font-semibold">Sarah Johnson</p>
                    <p className="text-sm text-gray-500">High School Science Teacher</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-600 mb-4">
                  "The variety of question types and difficulty levels makes this perfect for creating differentiated assessments for my diverse classroom."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-zolvio-purple rounded-full mr-3"></div>
                  <div>
                    <p className="font-semibold">David Martinez</p>
                    <p className="text-sm text-gray-500">Middle School Math Teacher</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-600 mb-4">
                  "I was skeptical about AI-generated content, but Zolvio.ai surprised me with its accuracy and thoughtful questions aligned with curriculum standards."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-zolvio-purple rounded-full mr-3"></div>
                  <div>
                    <p className="font-semibold">Jennifer Lee</p>
                    <p className="text-sm text-gray-500">University Professor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-16 bg-zolvio-purple">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Assessment Process?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-3xl mx-auto">
              Join thousands of educators who are saving time and improving student outcomes with Zolvio.ai.
            </p>
            <Button size="lg" className="bg-white text-zolvio-purple hover:bg-gray-100">
              Get Started For Free
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
