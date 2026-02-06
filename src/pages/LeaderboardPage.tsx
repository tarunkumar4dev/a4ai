// src/pages/LeaderboardPage.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Medal, 
  TrendingUp, 
  Search, 
  Filter,
  ChevronRight,
  Star,
  Crown,
  Sparkles,
  Flame,
  Target,
  Zap,
  Users,
  Award,
  BarChart3,
  TrendingDown,
  Minus
} from 'lucide-react';
import confetti from 'canvas-confetti';

const LeaderboardPage = () => {
  const [leaderboardData, setLeaderboardData] = useState([
    { 
      id: 1, 
      rank: 1, 
      name: 'Harsh Kumar', 
      score: 7090, 
      college: 'PTU Main Campus', 
      avatarColor: 'from-[#FFD700] via-[#FFA500] to-[#FF8C00]', 
      progress: 98, 
      change: 'up', 
      streak: 12,
      achievements: ['Top Performer', 'Weekly King'],
      level: 'Diamond',
      dailyGain: '+327'
    },
    { 
      id: 2, 
      rank: 2, 
      name: 'Shahil Siddhant', 
      score: 3190, 
      college: 'PTU Delhi Campus', 
      avatarColor: 'from-[#C0C0C0] via-[#A0A0A0] to-[#808080]', 
      progress: 85, 
      change: 'up', 
      streak: 8,
      achievements: ['Rising Star'],
      level: 'Platinum',
      dailyGain: '+189'
    },
    { 
      id: 3, 
      rank: 3, 
      name: 'Shivam Kumar', 
      score: 1856, 
      college: 'PTU Chandigarh Campus', 
      avatarColor: 'from-[#CD7F32] via-[#B87333] to-[#966919]', 
      progress: 76, 
      change: 'up', 
      streak: 5,
      achievements: ['Consistent'],
      level: 'Gold',
      dailyGain: '+112'
    },
    { 
      id: 4, 
      rank: 4, 
      name: 'Priya Sharma', 
      score: 1789, 
      college: 'PTU Main Campus', 
      avatarColor: 'from-[#FF6B9D] via-[#FF4081] to-[#E91E63]', 
      progress: 72, 
      change: 'down', 
      streak: 3,
      level: 'Gold',
      dailyGain: '-45'
    },
    { 
      id: 5, 
      rank: 5, 
      name: 'Rahul Verma', 
      score: 1654, 
      college: 'PTU Mumbai Campus', 
      avatarColor: 'from-[#4FC3F7] via-[#29B6F6] to-[#0288D1]', 
      progress: 68, 
      change: 'stable', 
      streak: 7,
      level: 'Silver',
      dailyGain: '+12'
    },
    { 
      id: 6, 
      rank: 6, 
      name: 'Anjali Singh', 
      score: 1543, 
      college: 'PTU Main Campus', 
      avatarColor: 'from-[#BA68C8] via-[#AB47BC] to-[#8E24AA]', 
      progress: 65, 
      change: 'up', 
      streak: 4,
      level: 'Silver',
      dailyGain: '+98'
    },
    { 
      id: 7, 
      rank: 7, 
      name: 'Vikram Patel', 
      score: 1421, 
      college: 'PTU Ahmedabad Campus', 
      avatarColor: 'from-[#66BB6A] via-[#4CAF50] to-[#388E3C]', 
      progress: 61, 
      change: 'up', 
      streak: 6,
      level: 'Silver',
      dailyGain: '+76'
    },
    { 
      id: 8, 
      rank: 8, 
      name: 'Neha Gupta', 
      score: 1387, 
      college: 'PTU Delhi Campus', 
      avatarColor: 'from-[#26C6DA] via-[#00BCD4] to-[#0097A7]', 
      progress: 58, 
      change: 'down', 
      streak: 2,
      level: 'Bronze',
      dailyGain: '-21'
    },
    { 
      id: 9, 
      rank: 9, 
      name: 'Amit Yadav', 
      score: 1256, 
      college: 'PTU Main Campus', 
      avatarColor: 'from-[#FF7043] via-[#FF5722] to-[#D84315]', 
      progress: 54, 
      change: 'down', 
      streak: 1,
      level: 'Bronze',
      dailyGain: '-33'
    },
    { 
      id: 10, 
      rank: 10, 
      name: 'Sneha Reddy', 
      score: 1198, 
      college: 'PTU Hyderabad Campus', 
      avatarColor: 'from-[#7986CB] via-[#5C6BC0] to-[#3949AB]', 
      progress: 52, 
      change: 'up', 
      streak: 9,
      achievements: ['Comeback Kid'],
      level: 'Bronze',
      dailyGain: '+154'
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState('weekly');
  const [selectedCollege, setSelectedCollege] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [celebrate, setCelebrate] = useState(false);

  const userRank = { rank: 42, name: 'You', score: 856, progress: 45, change: 'up', streak: 3 };

  useEffect(() => {
    if (celebrate) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => setCelebrate(false), 1000);
    }
  }, [celebrate]);

  const getLevelColor = (level: string) => {
    const colors = {
      'Diamond': 'text-[#b9f2ff] border-[#b9f2ff]',
      'Platinum': 'text-[#e5e4e2] border-[#e5e4e2]',
      'Gold': 'text-[#FFD700] border-[#FFD700]',
      'Silver': 'text-[#C0C0C0] border-[#C0C0C0]',
      'Bronze': 'text-[#CD7F32] border-[#CD7F32]'
    };
    return colors[level as keyof typeof colors] || 'text-gray-400 border-gray-400';
  };

  const getRankGlow = (rank: number) => {
    if (rank === 1) return 'shadow-[0_0_40px_rgba(255,215,0,0.5)]';
    if (rank === 2) return 'shadow-[0_0_30px_rgba(192,192,192,0.4)]';
    if (rank === 3) return 'shadow-[0_0_20px_rgba(205,127,50,0.3)]';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 blur-xl opacity-50"></div>
                  <Trophy className="relative w-10 h-10 text-yellow-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
                  ELITE LEADERBOARD
                </h1>
              </div>
              <p className="text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-cyan-400 font-semibold">370</span> warriors battling for glory
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCelebrate(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              <Zap className="w-5 h-5" />
              Claim Rewards
            </motion.button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: Trophy, label: 'Total Score', value: '2,84,500', color: 'from-yellow-500 to-orange-500' },
              { icon: TrendingUp, label: 'Active Streaks', value: '127', color: 'from-green-500 to-emerald-500' },
              { icon: Award, label: 'Avg. Level', value: 'Gold II', color: 'from-blue-500 to-cyan-500' },
              { icon: Target, label: 'Competition', value: 'EXTREME', color: 'from-red-500 to-pink-500' }
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} relative overflow-hidden group hover:scale-[1.02] transition-transform`}
              >
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <stat.icon className="w-8 h-8 opacity-80" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search warriors by name or college..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
            
            <div className="flex gap-3">
              {['weekly', 'monthly', 'all-time'].map((period) => (
                <motion.button
                  key={period}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTimeframe(period)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timeframe === period 
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/25' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {period}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* 2nd Place */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-600 to-slate-400 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-6">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 ${getRankGlow(2)} flex items-center justify-center`}>
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
              </div>
              <div className="pt-10 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">SS</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-200">Shahil Siddhant</h3>
                <p className="text-gray-400 text-sm mb-4">PTU Delhi Campus</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-gray-800 rounded-full text-sm">Platinum</div>
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Flame className="w-4 h-4" />
                    <span>8 day streak</span>
                  </div>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-gray-300 to-gray-100 bg-clip-text text-transparent">
                  3,190
                </div>
              </div>
            </div>
          </motion.div>

          {/* 1st Place - Champion */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative group lg:scale-110 lg:-translate-y-4"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 animate-pulse"></div>
            <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-2xl border-2 border-yellow-500/50 p-8">
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 ${getRankGlow(1)} flex items-center justify-center relative`}>
                  <Crown className="w-8 h-8 text-white" />
                  <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 animate-spin" />
                </div>
              </div>
              <div className="absolute top-4 left-4">
                <div className="px-3 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-full text-xs font-bold">
                  👑 CHAMPION
                </div>
              </div>
              <div className="pt-14 text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center relative">
                  <span className="text-4xl font-bold text-white">HK</span>
                  <div className="absolute -bottom-2 px-3 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-full text-xs font-bold">
                    +12 🔥
                  </div>
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Harsh Kumar
                </h3>
                <p className="text-gray-300 mb-4">PTU Main Campus</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full text-sm">
                    Diamond Tier
                  </div>
                  <div className="text-yellow-300">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                </div>
                <div className="text-5xl font-bold bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  7,090
                </div>
                <div className="text-green-400 text-sm mt-2">+327 today</div>
              </div>
            </div>
          </motion.div>

          {/* 3rd Place */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-700 to-amber-900 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-6">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 ${getRankGlow(3)} flex items-center justify-center`}>
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
              </div>
              <div className="pt-10 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">SK</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-200">Shivam Kumar</h3>
                <p className="text-gray-400 text-sm mb-4">PTU Chandigarh Campus</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-amber-900/50 rounded-full text-sm">Gold</div>
                  <div className="flex items-center gap-1 text-orange-400">
                    <Zap className="w-4 h-4" />
                    <span>5 day streak</span>
                  </div>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
                  1,856
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">ELITE WARRIORS</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <BarChart3 className="w-4 h-4" />
              <span>Real-time updates • Live competition</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-800">
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">RANK</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">WARRIOR</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">COLLEGE</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">LEVEL</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">SCORE</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">TREND</th>
                    <th className="py-4 px-6 text-left text-gray-300 font-semibold">DAILY</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.slice(3).map((entry, index) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            entry.rank <= 3 
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                              : 'bg-gradient-to-br from-gray-700 to-gray-900'
                          }`}>
                            {entry.rank}
                          </div>
                          {entry.change === 'up' && (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${entry.avatarColor} flex items-center justify-center`}>
                            <span className="font-bold text-white">
                              {entry.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-white">{entry.name}</div>
                            {entry.streak > 5 && (
                              <div className="flex items-center gap-1 text-xs text-orange-400">
                                <Flame className="w-3 h-3" />
                                <span>{entry.streak} day streak</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-gray-300">{entry.college}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={`px-3 py-1 rounded-full text-sm border ${getLevelColor(entry.level)} bg-black/50 inline-block`}>
                          {entry.level}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-2xl font-bold text-white">{entry.score.toLocaleString()}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {entry.change === 'up' ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <TrendingUp className="w-5 h-5" />
                              <span className="font-semibold">RISING</span>
                            </div>
                          ) : entry.change === 'down' ? (
                            <div className="flex items-center gap-1 text-red-400">
                              <TrendingDown className="w-5 h-5" />
                              <span className="font-semibold">FALLING</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <Minus className="w-5 h-5" />
                              <span className="font-semibold">STABLE</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={`text-lg font-bold ${
                          entry.dailyGain.startsWith('+') 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          {entry.dailyGain}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Your Position Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 blur-xl opacity-50"></div>
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">YOU</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Your Journey</h3>
                  <p className="text-gray-400">
                    Rank <span className="text-cyan-400 font-bold">#{userRank.rank}</span> • {userRank.score} points
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>Climbing +2 spots this week</span>
                    </div>
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Flame className="w-4 h-4" />
                      <span>{userRank.streak} day streak</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{userRank.score}</div>
                  <div className="text-sm text-gray-400">Total Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">+{userRank.progress}%</div>
                  <div className="text-sm text-gray-400">Progress</div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold flex items-center gap-3 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  <Target className="w-5 h-5" />
                  Challenge Top 10
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LeaderboardPage;