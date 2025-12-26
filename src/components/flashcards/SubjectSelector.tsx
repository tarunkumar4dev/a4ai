import React from 'react';
import { motion } from 'framer-motion';
import { subjectsData } from '@/data/ncertFlashcards';
import { 
  Beaker, 
  Calculator, 
  Atom, 
  BookOpen,
  Globe,
  History,
  FileText
} from 'lucide-react';

const subjectIcons: Record<string, React.ComponentType> = {
  Science: Beaker,
  Mathematics: Calculator,
  Physics: Atom,
  Chemistry: Beaker,
  Biology: BookOpen,
  Geography: Globe,
  History: History,
  English: FileText
};

interface SubjectSelectorProps {
  selectedClass: number | null;
  selectedSubject: string | null;
  onSelectSubject: (subject: string) => void;
}

export default function SubjectSelector({
  selectedClass,
  selectedSubject,
  onSelectSubject
}: SubjectSelectorProps) {
  const availableSubjects = subjectsData.filter(subject =>
    subject.availableClasses.includes(selectedClass!)
  );

  const getSubjectColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200',
      amber: 'bg-amber-100 text-amber-600 border-amber-200'
    };
    return colors[color] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (!selectedClass) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <BookOpen className="text-amber-600" size={24} />
        </div>
        <h3 className="text-lg font-semibold text-amber-800 mb-2">
          Select a Class First
        </h3>
        <p className="text-sm text-amber-700">
          Choose your class from the options above to see available subjects
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-effect rounded-3xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <BookOpen className="text-white" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Choose Subject</h3>
          <p className="text-sm text-slate-500">
            Select a subject for Class {selectedClass}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {availableSubjects.map((subject) => {
          const Icon = subjectIcons[subject.name] || BookOpen;
          const isSelected = selectedSubject === subject.name;
          
          return (
            <motion.button
              key={subject.name}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectSubject(subject.name)}
              className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 ${
                isSelected
                  ? `${getSubjectColor(subject.color)} ring-2 ring-offset-2 ring-blue-400`
                  : `${getSubjectColor(subject.color)} hover:bg-white/50`
              }`}
            >
              {/* Background glow effect */}
              {isSelected && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 to-blue-600/10" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                  isSelected ? 'bg-white shadow-lg' : 'bg-white/80 shadow-md'
                }`}>
                  <Icon className={
                    subject.color === 'emerald' ? 'text-emerald-600' :
                    subject.color === 'indigo' ? 'text-indigo-600' :
                    subject.color === 'blue' ? 'text-blue-600' :
                    'text-slate-600'
                  } size={24} />
                </div>
                
                <span className="text-sm font-semibold text-slate-900 mb-1">
                  {subject.name}
                </span>
                <span className="text-xs text-slate-500">
                  {subject.code}
                </span>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -top-2 -right-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {availableSubjects.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <BookOpen className="text-slate-400" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No Subjects Available
          </h3>
          <p className="text-sm text-slate-500">
            Subjects for Class {selectedClass} will be added soon
          </p>
        </div>
      )}
    </motion.div>
  );
}