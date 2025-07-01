// pages/pricing.tsx
import React from 'react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-700 to-blue-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with modern typography */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Choose the perfect plan for your educational needs
          </p>
        </div>

        {/* Pricing cards grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Individual Teacher Plan */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Individual Teacher</h2>
                  <p className="text-blue-600">Perfect for solo educators</p>
                </div>
              </div>
              
              <div className="my-6">
                <span className="text-5xl font-extrabold text-gray-900">₹299</span>
                <span className="text-gray-500">/month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {['Unlimited test papers', 'Basic analytics', 'Email support'].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-violet-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7z" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center">
                Get Started
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Institutes Plan (Featured) */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-blue-400 transform hover:scale-[1.02] transition-all duration-300 relative">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-bold px-4 py-2 rounded-bl-lg">
              Most Popular
            </div>
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Institutes</h2>
                  <p className="text-blue-600">Ideal for coaching centers</p>
                </div>
              </div>
              
              <div className="my-6">
                <span className="text-5xl font-extrabold text-gray-900">₹2,999</span>
                <span className="text-gray-500">/month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {['Multiple teachers', 'Student groups', 'Advanced analytics', 'Priority support'].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7z" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button className="w-full bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-700 hover:to-blue-600 text-white font-medium py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center">
                Get Started
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Schools Plan */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Schools</h2>
                  <p className="text-blue-600">Complete solution</p>
                </div>
              </div>
              
              <div className="my-6">
                <span className="text-5xl font-extrabold text-gray-900">₹9,999</span>
                <span className="text-gray-500">/month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {['Full dashboard access', 'Test platform', 'Notes generator', 'Dedicated manager'].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-indigo-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7z" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center">
                Get Started
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-white/10 backdrop-blur-sm text-white px-6 py-4 rounded-full border border-white/20 hover:bg-white/20 transition duration-200">
            <p>Need a custom solution? <a href="#" className="font-semibold underline underline-offset-4">Contact us</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}