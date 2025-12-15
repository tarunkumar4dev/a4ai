import React from "react";
import clsx from "clsx";

interface FancyInputProps {
  label: string;
  name: string;
  placeholder?: string;
  register: any;
  className?: string;
  type?: string;
}

export const FancyInput = ({ label, name, placeholder, register, className, type = "text" }: FancyInputProps) => {
  return (
    <div className={clsx("space-y-2 group", className)}>
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-[#2563EB] transition-colors duration-200">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          {...register(name)}
          placeholder={placeholder}
          className="w-full bg-white text-[#111827] text-sm font-semibold placeholder:text-gray-300 placeholder:font-medium
          rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
          shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] 
          focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] focus:border-[#6366F1]
          hover:border-gray-300"
        />
      </div>
    </div>
  );
};