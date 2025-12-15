import React from "react";
import { ChevronDown, LucideIcon } from "lucide-react";

interface FancySelectProps {
  label: string;
  name: string;
  options: string[];
  register: any;
  icon?: LucideIcon;
}

export const FancySelect = ({ label, name, options, register, icon: Icon }: FancySelectProps) => {
  return (
    <div className="space-y-2 group">
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-[#2563EB] transition-colors duration-200">
        {Icon && <Icon size={12} />} {label}
      </label>
      <div className="relative">
        <select
          {...register(name)}
          className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
          rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
          shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] 
          focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] focus:border-[#6366F1]
          cursor-pointer hover:border-gray-300"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown 
          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#2563EB] transition-colors" 
          size={18} 
        />
      </div>
    </div>
  );
};