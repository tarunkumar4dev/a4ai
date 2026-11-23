import React from "react";

export const PLAYSTORE_URL =
  "https://play.google.com/store/apps/details?id=in.a4ai.app";

/**
 * Colorful Google Play logo icon with official geometry & brand colors:
 * #4285F4 (Blue), #34A853 (Green), #EA4335 (Red), #FBBC04 (Yellow)
 */
export function GooglePlayLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M1.39 41.86C0 46.04 0 51.63 0 57.2v397.64c0 5.57 0 9.76 1.4 15.34l216.27-214.86L1.39 41.86z"
      />
      <path
        fill="#34A853"
        d="M199.42 273.45 329.27 145.1 87.9 8.37C79.53 2.79 68.36 0 57.2 0 30.7 0 6.98 18.14 1.4 41.86l198.02 231.59z"
      />
      <path
        fill="#EA4335"
        d="M199.9 237.8 1.4 470.17c7.22 24.57 30.16 41.81 55.8 41.81 11.16 0 20.93-2.79 29.3-8.37l244.16-139.46L199.9 237.8z"
      />
      <path
        fill="#FBBC04"
        d="m433.91 205.1-104.65-60-111.61 110.22 113.01 108.83 104.64-58.6c18.14-9.77 30.7-29.3 30.7-50.23-1.4-20.93-13.95-40.46-32.09-50.22z"
      />
    </svg>
  );
}

interface GooglePlayButtonProps {
  className?: string;
  variant?: "dark" | "outline";
}

export default function GooglePlayButton({
  className = "",
  variant = "dark",
}: GooglePlayButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2.5 rounded-xl px-5 sm:px-6 transition-all duration-150 active:scale-[0.98] select-none text-left";

  const themeClasses =
    variant === "dark"
      ? "bg-[#111111] text-white hover:bg-[#222222] border border-black/10 shadow-sm hover:shadow"
      : "bg-white text-[#111111] border-2 border-[#E5E7EB] hover:border-[#111111] hover:bg-gray-50 shadow-sm hover:shadow";

  return (
    <a
      href={PLAYSTORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download a4ai on Google Play Store"
      className={`${baseClasses} ${themeClasses} ${className}`}
    >
      <GooglePlayLogo className="h-6 w-6 shrink-0" />
      <div className="flex flex-col text-left leading-none">
        <span
          className={`text-[9px] font-semibold uppercase tracking-wider ${
            variant === "dark" ? "text-gray-300" : "text-[#5D6570]"
          }`}
        >
          GET IT ON
        </span>
        <span
          className={`text-[14px] sm:text-[15px] font-bold mt-0.5 tracking-tight ${
            variant === "dark" ? "text-white" : "text-[#1B1B1B]"
          }`}
        >
          Google Play
        </span>
      </div>
    </a>
  );
}
