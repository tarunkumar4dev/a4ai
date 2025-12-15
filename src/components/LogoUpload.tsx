import React, { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFormContext } from "react-hook-form";

export const LogoUpload = () => {
  const { setValue } = useFormContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setValue("logo", file);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
      e.stopPropagation();
      setPreview(null);
      setValue("logo", null);
      if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="h-full">
      <input 
        type="file" 
        ref={fileRef} 
        className="hidden" 
        accept="image/png, image/jpeg" 
        onChange={handleFile} 
      />
      <motion.div 
        whileHover={{ scale: 1.02, borderColor: "#9CA3AF" }} 
        whileTap={{ scale: 0.98 }}
        onClick={() => fileRef.current?.click()}
        className={`h-full min-h-[160px] rounded-[22px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group
        ${preview ? 'border-gray-400 bg-gray-50' : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-gray-400 hover:bg-gray-50'}`}
      >
        <AnimatePresence>
          {preview ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full h-full p-4 flex items-center justify-center">
              <img src={preview} className="max-h-28 object-contain drop-shadow-md" alt="Logo Preview" />
              <motion.button 
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={removeLogo}
                className="absolute top-3 right-3 p-2 bg-white shadow-lg rounded-full text-red-500 hover:bg-red-50 transition-colors z-10"
              >
                <X size={14} />
              </motion.button>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center z-10 p-6 text-center">
              <motion.div 
                whileHover={{ y: -5 }}
                className="p-4 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] mb-4 group-hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] transition-all duration-300"
              >
                <Upload size={24} className="text-gray-600" />
              </motion.div>
              <span className="text-sm font-bold text-[#111827] group-hover:text-gray-700 transition-colors">Click to Upload Logo</span>
              <span className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-wide">PNG, JPG (Max 2MB)</span>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};