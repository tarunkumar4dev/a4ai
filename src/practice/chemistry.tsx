// src/practice/chemistry.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FlaskConical, 
  Beaker, 
  Atom, 
  TestTube, 
  Droplets,
  ChevronRight,
  Award,
  Clock,
  BookOpen,
  Zap,
  Home,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ChemistryPracticePage = () => {
  const navigate = useNavigate();

  const handleClassSelect = (className: string) => {
    console.log('🧪 Navigating to Chemistry practice:', { className, subject: 'Chemistry' });
    navigate(`/practice/session?class=${className}&subject=Chemistry`);
  };

  const handleBack = () => {
    navigate('/daily-practice');
  };

  const practiceTopics = [
    {
      class: '10',
      title: 'Class 10 Chemistry',
      description: 'Basic concepts, reactions, and formulas',
      topics: ['Acids & Bases', 'Metals & Non-metals', 'Carbon Compounds', 'Periodic Table'],
      questions: 15,
      gradient: 'from-blue-500 to-cyan-500',
      icon: <FlaskConical className="h-8 w-8" />
    },
    {
      class: '12',
      title: 'Class 12 Chemistry',
      description: 'Advanced organic & inorganic chemistry',
      topics: ['Organic Chemistry', 'Biomolecules', 'Polymers', 'Electrochemistry'],
      questions: 25,
      gradient: 'from-purple-500 to-pink-500',
      icon: <Atom className="h-8 w-8" />
    },
    {
      class: 'JEE',
      title: 'JEE Chemistry',
      description: 'Competitive level physical & inorganic chemistry',
      topics: ['Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry', 'Coordination'],
      questions: 35,
      gradient: 'from-red-500 to-orange-500',
      icon: <TestTube className="h-8 w-8" />
    },
    {
      class: 'NEET',
      title: 'NEET Chemistry',
      description: 'Medical entrance focused questions',
      topics: ['Organic Chemistry', 'Biomolecules', 'Environmental', 'Chemistry in Life'],
      questions: 30,
      gradient: 'from-green-500 to-emerald-500',
      icon: <Droplets className="h-8 w-8" />
    }
  ];

  const stats = [
    { icon: <BookOpen className="h-5 w-5" />, label: 'Total Questions', value: '105+' },
    { icon: <Award className="h-5 w-5" />, label: 'Coins per Correct', value: '+5' },
    { icon: <Clock className="h-5 w-5" />, label: 'Time per Set', value: '10 min' },
    { icon: <Zap className="h-5 w-5" />, label: 'Difficulty Levels', value: '3' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-blue-100/50 bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all"
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-blue-900">
                  Chemistry Practice
                </h1>
                <p className="text-sm text-blue-600">
                  Master chemical reactions, formulas, and concepts
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => navigate('/daily-practice')}
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Home size={18} className="mr-2" />
              Back to Practice
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mb-6 shadow-lg">
            <FlaskConical className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Chemistry Practice Hub
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Solve chemistry problems across different levels. Earn coins for correct answers and track your progress.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-blue-100 shadow-sm">
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <div className="text-blue-600">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Practice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {practiceTopics.map((topic, index) => (
            <motion.div
              key={topic.class}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
            >
              <Card className="border-blue-100 shadow-lg hover:shadow-xl transition-shadow cursor-pointer overflow-hidden group"
                onClick={() => handleClassSelect(topic.class)}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${topic.gradient} opacity-10 rounded-full -translate-y-12 translate-x-12`} />
                
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${topic.gradient} flex items-center justify-center`}>
                        <div className="text-white">
                          {topic.icon}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{topic.title}</h3>
                        <p className="text-sm text-gray-600">{topic.description}</p>
                      </div>
                    </div>
                    
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {topic.questions} Q's
                    </Badge>
                  </div>

                  {/* Topics */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Topics Covered:</h4>
                    <div className="flex flex-wrap gap-2">
                      {topic.topics.map((t, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Click to start practice
                    </div>
                    <Button 
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClassSelect(topic.class);
                      }}
                    >
                      Start Practice
                      <ChevronRight size={18} className="ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12"
        >
          <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Tips for Chemistry Practice
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/50 p-4 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-2">Memorize Formulas</h4>
                  <p className="text-sm text-blue-700">Learn common chemical formulas and reactions.</p>
                </div>
                <div className="bg-white/50 p-4 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-2">Practice Naming</h4>
                  <p className="text-sm text-blue-700">Master IUPAC naming for organic compounds.</p>
                </div>
                <div className="bg-white/50 p-4 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-2">Understand Concepts</h4>
                  <p className="text-sm text-blue-700">Focus on understanding rather than rote learning.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Button
            onClick={() => navigate('/daily-practice')}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 mr-4"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to All Subjects
          </Button>
          <Button
            onClick={() => navigate('/practice/session?class=10&subject=Chemistry')}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            <FlaskConical size={18} className="mr-2" />
            Quick Start (Class 10)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChemistryPracticePage;