import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Award, Users } from 'lucide-react';

interface ClassSelectorProps {
  selectedClass: number | null;
  onSelectClass: (classNum: number) => void;
}

export default function ClassSelector({
  selectedClass,
  onSelectClass
}: ClassSelectorProps) {
  const classes = [
    { number: 9, label: 'Class 9', description: 'Foundation Level', color: 'from-blue-400 to-cyan-500' },
    { number: 10, label: 'Class 10', description: 'Board Preparation', color: 'from-emerald-400 to-green-500' },
    { number: 11, label: 'Class 11', description: 'Advanced Concepts', color: 'from-purple-400 to-pink-500' },
    { number: 12, label: 'Class 12', description: 'Competitive Edge', color: 'from-amber-400 to-orange-500' }
  ];

  const getClassIcon = (classNum: number) => {
    switch (classNum) {
      case 9: return BookOpen;
      case 10: return GraduationCap;
      case 11: return Award;
      case 12: return Users;
      default: return BookOpen;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-effect rounded-3xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <GraduationCap className="text-white" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Choose Your Class</h3>
          <p className="text-sm text-slate-500">
            Select your current academic level
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {classes.map((classInfo) => {
          const Icon = getClassIcon(classInfo.number);
          const isSelected = selectedClass === classInfo.number;
          
          return (
            <motion.button
              key={classInfo.number}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectClass(classInfo.number)}
              className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 ${
                isSelected
                  ? `bg-gradient-to-br ${classInfo.color} border-transparent text-white`
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              {/* Selection glow effect */}
              {isSelected && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                  isSelected
                    ? 'bg-white/20 backdrop-blur-sm'
                    : 'bg-gradient-to-br from-slate-100 to-slate-200'
                }`}>
                  <Icon className={
                    isSelected ? 'text-white' : 'text-slate-600'
                  } size={24} />
                </div>
                
                {/* Class label */}
                <span className={`text-lg font-bold mb-1 ${
                  isSelected ? 'text-white' : 'text-slate-900'
                }`}>
                  {classInfo.label}
                </span>
                
                {/* Description */}
                <span className={`text-xs ${
                  isSelected ? 'text-white/90' : 'text-slate-500'
                }`}>
                  {classInfo.description}
                </span>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -top-2 -right-2">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Class selection helper */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">Recommended:</span> Class 10 for board exams
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Award size={12} />
            Full NCERT coverage
          </div>
        </div>
      </div>
    </motion.div>
  );
}