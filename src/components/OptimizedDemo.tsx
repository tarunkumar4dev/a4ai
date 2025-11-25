// components/OptimizedDemo.jsx - Ye sahi version hai
import React, { useState, useRef } from 'react';

const OptimizedDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  return (
    <section className="py-16 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Search Bar - Side mein */}
        <div className="relative">
          <div className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 transform">
            <div className="rounded-lg bg-white p-4 shadow-xl ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                  <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Search records..."
                  className="w-48 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Video Container */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-8 shadow-2xl ring-1 ring-slate-200/70 dark:from-slate-900 dark:to-slate-950 dark:ring-white/10">
            <div className="relative overflow-hidden rounded-xl bg-slate-900">
              <div className="aspect-video w-full">
                {isPlaying ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    poster="/demo-poster.png"
                    onEnded={() => setIsPlaying(false)}
                  >
                    <source src="/demo.mp4" type="video/mp4" />
                    {/* Fallback */}
                    <div className="flex h-full items-center justify-center bg-slate-800">
                      <p className="text-white">Video not supported</p>
                    </div>
                  </video>
                ) : (
                  // Video Thumbnail with Play Button
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <button
                      onClick={() => setIsPlaying(true)}
                      className="group flex items-center gap-3 rounded-full bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition-all hover:bg-white/20"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                        <svg className="h-6 w-6 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <span className="text-lg font-medium">Watch Demo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Interface Overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="rounded-lg bg-white/95 p-4 backdrop-blur-sm dark:bg-slate-800/95">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 dark:bg-slate-700">
                      <svg className="h-3 w-3 text-slate-600 dark:text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Searched records</span>
                  </div>
                  
                  <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-700">
                    <div className="border-b border-slate-200 p-4 dark:border-slate-600">
                      <p className="text-slate-700 dark:text-slate-300">
                        "So just to recap—you need new cabinets and lighting. I'll send you a quote within the hour. Let's do a kickoff call next Wednesday if that works for you?"
                      </p>
                    </div>
                    
                    <div className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">What should I say?</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-600 dark:text-slate-300">Follow-up questions</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 dark:border-slate-500">
                          <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Ask, start typing..."
                          className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OptimizedDemo;