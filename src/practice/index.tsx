// src/pages/practice/index.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  ArrowLeft, 
  Award, 
  Clock, 
  Flame, 
  BookOpen, 
  Zap, 
  Trophy, 
  Star, 
  ChevronRight,
  Sparkles,
  Users,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase, practiceDB } from '@/lib/supabaseClient';

const PracticeSelectionPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({
    streak: 0,
    totalCoins: 0,
    todayAttempted: 0
  });
  const [loading, setLoading] = useState(true);

  // Get user info and stats
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      if (user?.id) {
        // Get user profile and stats
        const profile = await practiceDB.getUserPracticeProfile(user.id);
        const todayStats = await practiceDB.getUserPracticeStats(user.id);
        
        setUserStats({
          streak: profile?.practice_streak || 0,
          totalCoins: profile?.total_coins || 0,
          todayAttempted: todayStats.attempted
        });
      }
      
      setLoading(false);
    };
    
    initialize();
  }, []);

  // Available practice options
  const practiceOptions = [
    {
      id: '10',
      title: 'Class 10',
      subject: 'Science',
      icon: '🔬',
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Physics, Chemistry, Biology',
      color: 'blue'
    },
    {
      id: '12',
      title: 'Class 12',
      subject: 'Physics',
      icon: '⚛️',
      gradient: 'from-green-500 to-emerald-600',
      description: 'Advanced Concepts',
      color: 'green'
    },
    {
      id: 'JEE',
      title: 'JEE',
      subject: 'Physics',
      icon: '🚀',
      gradient: 'from-purple-500 to-pink-500',
      description: 'Engineering Entrance',
      color: 'purple'
    },
    {
      id: 'NEET',
      title: 'NEET',
      subject: 'Biology',
      icon: '🧬',
      gradient: 'from-red-500 to-orange-500',
      description: 'Medical Entrance',
      color: 'red'
    }
  ];

  const handleStartPractice = async (classId: string, subject: string) => {
    if (!userId) {
      navigate('/login?redirect=/practice');
      return;
    }

    // Check if user has already attempted 5 questions today
    if (userStats.todayAttempted >= 5) {
      alert('🎉 You have already completed your daily practice! Come back tomorrow for new questions.');
      return;
    }

    // Check how many questions are available
    const availableQuestions = await practiceDB.getPracticeQuestions(classId, subject, 5);
    
    if (availableQuestions.length === 0) {
      alert(`No questions available for ${classId} - ${subject} at the moment.`);
      return;
    }

    // Navigate to practice session
    navigate(`/practice/session?class=${classId}&subject=${subject}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      {/* Header - Similar to ContestLandingPage */}
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[64px] sm:h-[72px] flex items-center justify-between gap-2">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Daily <span className="text-indigo-600">Practice</span>
                </h1>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-3">
              {/* Streak */}
              {userStats.streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                  <Flame size={14} className="text-orange-500 fill-orange-500" />
                  <span className="font-bold text-orange-700 text-sm">
                    {userStats.streak} day streak
                  </span>
                </div>
              )}

              {/* Coins */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-100">
                <Award size={14} className="text-yellow-600" />
                <span className="font-bold text-yellow-700 text-sm">
                  {userStats.totalCoins}
                </span>
              </div>

              {/* Progress */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <Trophy size={14} className="text-blue-600" />
                <span className="font-bold text-blue-700 text-sm">
                  {userStats.todayAttempted}/5
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Daily Practice Challenge
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Solve 5 questions daily. Earn <span className="font-bold text-yellow-600">+5 coins</span> for each correct answer.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Clock className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Daily Questions</h3>
                  <p className="text-2xl font-bold text-slate-900">5 Max</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Zap className="text-green-600" size={24} />
                </div>
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Coins Reward</h3>
                  <p className="text-2xl font-bold text-slate-900">+5 Each</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-purple-600" size={24} />
                </div>
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Today's Progress</h3>
                  <p className="text-2xl font-bold text-slate-900">{userStats.todayAttempted}/5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Practice Options */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" /> 
            Choose Your Practice Set
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {practiceOptions.map((option, index) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card className={`rounded-2xl border-${option.color}-100 hover:border-${option.color}-300 transition-all cursor-pointer overflow-hidden`}>
                  <CardContent className="p-0">
                    <div 
                      onClick={() => handleStartPractice(option.id, option.subject)}
                      className="p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-3xl mb-2">{option.icon}</div>
                          <h3 className="text-xl font-bold text-slate-900 mb-1">
                            {option.title}
                          </h3>
                          <p className="text-slate-600">{option.description}</p>
                        </div>
                        <Badge 
                          className={`bg-${option.color}-100 text-${option.color}-700 border-${option.color}-200`}
                        >
                          {option.subject}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                        <div className="text-sm text-slate-500">
                          5 questions • 10 minutes
                        </div>
                        <Button 
                          size="sm" 
                          className={`bg-${option.color}-600 hover:bg-${option.color}-700 text-white`}
                        >
                          Start Practice
                          <ChevronRight size={16} className="ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <Card className="rounded-2xl border-slate-200 shadow-sm mb-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
              How Daily Practice Works
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  title: "Choose Your Level",
                  description: "Select class or entrance exam",
                  icon: "🎯"
                },
                {
                  step: 2,
                  title: "Solve Questions",
                  description: "Answer 5 questions with timer",
                  icon: "📝"
                },
                {
                  step: 3,
                  title: "Earn Rewards",
                  description: "Get coins for correct answers",
                  icon: "🪙"
                },
                {
                  step: 4,
                  title: "Track Progress",
                  description: "Maintain streak and climb leaderboard",
                  icon: "📊"
                }
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="text-xs font-bold text-indigo-600 mb-2">STEP {item.step}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Safety Note */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900">Fair Practice Environment</h4>
            <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
              Your practice progress is saved automatically. Complete all 5 questions to earn bonus coins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeSelectionPage;