import React from "react";
import { LayoutGrid, Layers } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface TabBarProps {
  activeMode: "custom" | "cbse";
  onModeChange: (mode: "custom" | "cbse") => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeMode, onModeChange }) => {
  const tabs = [
    {
      id: "custom" as const,
      icon: LayoutGrid,
      label: "Custom Paper",
      badge: "Flexible Marks & Types",
    },
    {
      id: "cbse" as const,
      icon: Layers,
      label: "CBSE Standard Pattern",
      badge: "38 Qs • 80 Marks • 5 Sec",
    },
  ];

  return (
    <div className="flex justify-center mb-6 sm:mb-8">
      <div className="bg-white p-1.5 rounded-2xl sm:rounded-[24px] inline-flex shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E5E7EB] gap-1">
        {tabs.map((tab) => {
          const isActive = activeMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onModeChange(tab.id)}
              className={clsx(
                "relative px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-[18px] text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 z-10 outline-none",
                isActive ? "text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGradient"
                  className="absolute inset-0 bg-gradient-to-br from-[#111827] to-[#374151] rounded-xl sm:rounded-[18px] shadow-md shadow-gray-900/20"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <tab.icon size={16} strokeWidth={2.5} />
                <span>{tab.label}</span>
                <span
                  className={clsx(
                    "text-[10px] px-2 py-0.5 rounded-full font-semibold hidden sm:inline-block",
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  )}
                >
                  {tab.badge}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};