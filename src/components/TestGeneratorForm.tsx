import React, { useState, useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Library, GraduationCap, Book, ChevronDown, Clock, Zap } from "lucide-react";

import { formSchema, FormSchema } from "@/lib/schema"; 
import { TestRowEditor } from "./TestRowEditor";
import { LogoUpload } from "./LogoUpload"; 
import { DifficultyMix } from "./DifficultyMix"; 
import { TabBar } from "./TabBar";
import { PreviewModal } from "./PreviewModal";
import { SummaryStats } from "./SummaryStats";

// --- LOCAL STYLED COMPONENTS (For specific form layout) ---

const PremiumInput = ({ label, name, placeholder, register }: any) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-gray-800 transition-colors">
      {label}
    </label>
    <div className="relative">
      <input
        {...register(name)}
        placeholder={placeholder}
        className="w-full bg-white text-[#111827] text-sm font-semibold placeholder:text-gray-300 placeholder:font-medium
        rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] 
        focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
        hover:border-gray-300"
      />
    </div>
  </div>
);

const PremiumSelect = ({ label, name, options, register, icon: Icon }: any) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      {Icon && <Icon size={12} />} {label}
    </label>
    <div className="relative">
      <select
        {...register(name)}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] 
        focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        <option value="">Select...</option>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="absolute right-5 top-4.5 text-gray-400 pointer-events-none group-hover:text-gray-800 transition-colors" size={16} />
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export default function TestGeneratorForm() {
  const [activeTab, setActiveTab] = useState<"Simple" | "Blueprint" | "Matrix" | "Buckets">("Simple");
  const [showPreview, setShowPreview] = useState(false);

  const methods = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      examTitle: "", 
      board: "IGCSE", 
      classGrade: "Class 10", 
      subject: "Physics", 
      mode: "Simple",
      simpleData: [{ id: "1", topic: "", quantity: 5, difficulty: "Medium", format: "PDF" }]
    },
  });

  // Watch board and classGrade values
  const board = useWatch({
    control: methods.control,
    name: "board"
  });

  const classGrade = useWatch({
    control: methods.control,
    name: "classGrade"
  });

  // Effect to automatically set subject to "Science" when CBSE and Class 10 are selected
  useEffect(() => {
    if (board === "CBSE" && classGrade === "Class 10") {
      methods.setValue("subject", "Science");
    }
  }, [board, classGrade, methods]);

  const onSubmit = (data: FormSchema) => { 
      console.log("Generating V4 Pro Test:", data);
      // alert("Generating Test..."); 
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <FormProvider {...methods}>
      <motion.form 
        onSubmit={methods.handleSubmit(onSubmit)} 
        className="space-y-10 pb-32"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        
        {/* 1. HERO CONFIGURATION CARD */}
        <motion.div 
          variants={itemVariants}
          className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Inputs */}
            <div className="lg:col-span-9 space-y-6">
               <PremiumInput label="Exam Title" name="examTitle" placeholder="e.g. Annual Final Assessment 2025" register={methods.register} />
               <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <PremiumSelect icon={Library} label="Board" name="board" options={["CBSE", "ICSE", "IGCSE", "IB"]} register={methods.register} />
                  <PremiumSelect icon={GraduationCap} label="Class" name="classGrade" options={["Class 9", "Class 10", "Class 11", "Class 12"]} register={methods.register} />
                  <PremiumSelect icon={Book} label="Subject" name="subject" options={["Physics", "Math", "Chemistry", "Biology", "Science"]} register={methods.register} />
               </div>
            </div>
            
            {/* Right Logo Upload */}
            <div className="lg:col-span-3">
               <LogoUpload />
            </div>
          </div>
        </motion.div>

        {/* 2. TABBED EDITOR SECTION */}
        <motion.div variants={itemVariants}>
            <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <TestRowEditor activeMode={activeTab} />
              </motion.div>
            </AnimatePresence>
        </motion.div>

        {/* 3. DIFFICULTY MIX & STATS */}
        <motion.div 
          variants={itemVariants}
          className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm flex flex-col lg:flex-row gap-8 items-center justify-between"
        >
            <div className="w-full lg:w-2/3">
                <DifficultyMix />
            </div>
            {/* Summary Stats (Inline) */}
            <SummaryStats />
        </motion.div>

        {/* 4. STICKY BOTTOM ACTION BAR */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.8 }}
          className="fixed bottom-8 left-0 w-full px-4 md:px-6 pointer-events-none z-50"
        >
             <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between bg-[#111827] text-white p-3 pl-6 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] pointer-events-auto border border-white/10 gap-4 md:gap-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Clock size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Est. Time: <span className="text-white">45s</span></span>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <motion.button 
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        type="button" 
                        onClick={() => setShowPreview(true)}
                        className="px-6 py-3.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex-1 md:flex-none"
                    >
                        Preview
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(255,255,255,0.2)" }} 
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        className="px-8 py-3.5 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl font-bold text-sm text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.6)] flex items-center justify-center gap-2 transition-all border border-white/10 flex-1 md:flex-none"
                    >
                        <Zap size={18} className="fill-yellow-400 text-yellow-400" />
                        Generate Test V4
                    </motion.button>
                </div>
             </div>
        </motion.div>

        {/* 5. PREVIEW MODAL */}
        <AnimatePresence>
            {showPreview && (
                <PreviewModal 
                    isOpen={showPreview} 
                    onClose={() => setShowPreview(false)} 
                    data={methods.getValues()} 
                />
            )}
        </AnimatePresence>

      </motion.form>
    </FormProvider>
  );
}