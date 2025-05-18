
const Footer = () => {
  return (
    <footer className="bg-white border-t py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <span className="text-2xl font-bold logo">Zolvio.ai</span>
            <p className="mt-2 text-gray-600">
              Smart test generation for modern educators.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-gray-600">
              <li><a href="#" className="hover:text-zolvio-purple">Features</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Pricing</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Demo</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">API</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-gray-600">
              <li><a href="#" className="hover:text-zolvio-purple">Documentation</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Help Center</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Blog</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Case Studies</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-gray-600">
              <li><a href="#" className="hover:text-zolvio-purple">About Us</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Careers</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Contact</a></li>
              <li><a href="#" className="hover:text-zolvio-purple">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-500">
            © {new Date().getFullYear()} Zolvio.ai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
