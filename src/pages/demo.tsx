// pages/demo.tsx
import React from "react";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-700 to-blue-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with modern typography */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Experience AI-Powered Test Generation
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Try our smart test generator with multi-LLM technology
          </p>
        </div>

        {/* Glass-morphism demo card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/20 p-8 sm:p-10">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">
              Generate Your Demo Test
            </h2>
            <div className="w-20 h-1 bg-blue-300 mx-auto rounded-full"></div>
          </div>

          <form className="space-y-6">
            {/* Modern form fields */}
            <div className="space-y-8">
              {[
                {
                  label: "Subject",
                  icon: (
                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  ),
                  placeholder: "Mathematics, Physics, History"
                },
                {
                  label: "Topic",
                  icon: (
                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  ),
                  placeholder: "Trigonometry, Quantum Mechanics"
                },
                {
                  label: "Difficulty Level",
                  icon: (
                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ),
                  type: "select",
                  options: ["Very Easy", "Easy", "Medium", "Hard", "Very Hard"]
                }
              ].map((field, idx) => (
                <div key={idx} className="group">
                  <label className="flex items-center text-sm font-medium text-blue-100 mb-2 uppercase tracking-wider">
                    <span className="mr-2">{field.icon}</span>
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <div className="relative">
                      <select className="w-full bg-white/10 text-white rounded-lg px-5 py-4 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent appearance-none pr-10">
                        {field.options.map((opt, i) => (
                          <option key={i} className="bg-violet-800 text-white" selected={opt === "Medium"}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      className="w-full bg-white/10 text-white rounded-lg px-5 py-4 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-blue-200/50"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Animated submit button */}
            <div className="pt-6">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-700 hover:to-blue-600 text-white font-medium py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center group"
              >
                <span className="group-hover:scale-105 transition-transform">
                  Generate Demo Test
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Floating info badge */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center bg-white/10 backdrop-blur-sm text-blue-100 px-6 py-3 rounded-full border border-white/20 hover:bg-white/20 transition duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 mr-2 text-blue-300"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">
              This is a demonstration preview. Full version coming soon!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}