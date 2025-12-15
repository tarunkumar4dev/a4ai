import React from "react";
import { LayoutGrid, Layers, Grid, Archive } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface TabBarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const TabBar = ({ activeTab, setActiveTab }: TabBarProps) => {
    const tabs = [
        { id: "Simple", icon: LayoutGrid, label: "Simple" },
        { id: "Blueprint", icon: Layers, label: "Blueprint" },
        { id: "Matrix", icon: Grid, label: "Matrix" },
        { id: "Buckets", icon: Archive, label: "Buckets" },
    ];

    return (
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1.5 rounded-[24px] inline-flex shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E5E7EB]">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "relative px-6 py-3 rounded-[18px] text-sm font-bold transition-all duration-300 flex items-center gap-2.5 z-10 outline-none",
                            activeTab === tab.id ? "text-white" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div 
                                layoutId="activeTabGradient"
                                className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 rounded-[18px] shadow-lg shadow-gray-900/20"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                           <tab.icon size={16} strokeWidth={2.5} /> {tab.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};