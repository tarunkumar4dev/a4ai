// src/practice/SubjectHub.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FlaskConical, Atom, ChevronRight, Award, Clock, BookOpen, Zap, Home, ArrowLeft, Moon, Sun
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const SubjectHub = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleClassSelect = (className: string) => { navigate(`/practice?class=${className}&subject=science`); };

  const practiceTopics = [
    { class: '10', title: 'Class 10 Science', description: 'Acids, Bases, Reactions', questions: 45, gradient: 'from-blue-500 to-cyan-500', icon: <FlaskConical className="h-8 w-8" /> },
    { class: '12', title: 'Class 12 Chemistry', description: 'Advanced organic', questions: 0, gradient: 'from-purple-500 to-pink-500', icon: <Atom className="h-8 w-8" /> }
  ];

  return (
    <div className={`min-h-screen font-sans ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
      <div className="p-4">
        <button onClick={() => navigate('/practice')} className="mb-4 flex items-center gap-2"><ArrowLeft /> Back</button>
        <h1 className="text-3xl font-bold mb-4">Science Hub</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {practiceTopics.map((topic, i) => (
            <div key={i} onClick={() => handleClassSelect(topic.class)} className={`p-6 rounded-2xl bg-gradient-to-br ${topic.gradient} text-white cursor-pointer`}>
              <div className="text-2xl mb-2 flex items-center gap-3">{topic.icon} {topic.title}</div>
              <div className="opacity-90">{topic.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default SubjectHub;
