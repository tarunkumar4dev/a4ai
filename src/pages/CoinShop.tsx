// src/pages/CoinShop.tsx
import React, { useState } from 'react';
import { useCoins } from '@/context/CoinContext';
import { useNavigate } from 'react-router-dom';
import * as lucide from 'lucide-react';

const CoinShop: React.FC = () => {
  const { coins, vouchers, redeemVoucher, addCoins } = useCoins();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vouchers' | 'earn' | 'categories'>('vouchers');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'All Brands', icon: '🌟', count: vouchers.length },
    { id: 'shopping', name: 'Shopping', icon: '🛍️', count: vouchers.filter(v => v.category === 'shopping').length },
    { id: 'food', name: 'Food & Dining', icon: '🍕', count: vouchers.filter(v => v.category === 'food').length },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬', count: vouchers.filter(v => v.category === 'entertainment').length },
    { id: 'education', name: 'Education', icon: '📚', count: vouchers.filter(v => v.category === 'education').length },
    { id: 'gaming', name: 'Gaming', icon: '🎮', count: vouchers.filter(v => v.category === 'gaming').length },
  ];

  const filteredVouchers = selectedCategory === 'all' 
    ? vouchers 
    : vouchers.filter(v => v.category === selectedCategory);

  const earningMethods = [
    {
      method: 'daily_login',
      name: 'Daily Login Bonus',
      description: 'Login every day to get coins',
      coins: 25,
      icon: <lucide.Calendar size={20} />,
      action: () => addCoins(25, 'Daily login bonus')
    },
    {
      method: 'contest_participation',
      name: 'Join a Contest',
      description: 'Earn coins for participating in any contest',
      coins: 50,
      icon: <lucide.Trophy size={20} />,
      action: () => navigate('/contests')
    },
    {
      method: 'contest_win',
      name: 'Win a Contest',
      description: 'Bonus coins for finishing in top 3',
      coins: 200,
      icon: <lucide.Award size={20} />,
      action: () => navigate('/contests')
    },
    {
      method: 'solve_problems',
      name: 'Solve Practice Problems',
      description: 'Earn coins for solving practice problems',
      coins: 10,
      icon: <lucide.CheckCircle size={20} />,
      action: () => navigate('/practice')
    },
    {
      method: 'complete_lesson',
      name: 'Complete Lessons',
      description: 'Finish learning modules and lessons',
      coins: 30,
      icon: <lucide.BookOpen size={20} />,
      action: () => navigate('/learn')
    },
    {
      method: 'weekly_streak',
      name: 'Weekly Streak Bonus',
      description: 'Maintain 7-day learning streak',
      coins: 100,
      icon: <lucide.Flame size={20} />,
      action: () => addCoins(100, 'Weekly streak bonus')
    },
  ];

  const handleRedeem = async (voucher: typeof vouchers[0]) => {
    const success = await redeemVoucher(voucher.id);
    if (!success) {
      alert(`You need ${voucher.coinsRequired} coins to redeem this voucher. Keep learning and earning!`);
    }
  };

  const getPopularityColor = (popularity: string) => {
    switch (popularity) {
      case 'trending': return 'from-red-500 to-pink-500';
      case 'popular': return 'from-blue-500 to-purple-500';
      default: return 'from-green-500 to-emerald-500';
    }
  };

  const getPopularityBadge = (popularity: string) => {
    switch (popularity) {
      case 'trending': return '🔥 Trending';
      case 'popular': return '⭐ Popular';
      default: return '📊 Regular';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">🎁 Reward Store</h1>
          <div className="bg-white rounded-2xl shadow-lg p-6 inline-block">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-400 rounded-full p-3">
                <lucide.Coins size={32} className="text-yellow-800" />
              </div>
              <div className="text-left">
                <p className="text-gray-600 text-sm">Your Coin Balance</p>
                <p className="text-3xl font-bold text-gray-900">{coins.toLocaleString()} coins</p>
                <p className="text-sm text-green-600 font-semibold">Redeem for real vouchers!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-lg">
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'vouchers' 
                  ? 'bg-purple-500 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('vouchers')}
            >
              🎯 Redeem Vouchers
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'categories' 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('categories')}
            >
              🛍️ By Category
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'earn' 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('earn')}
            >
              💰 Earn Coins
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'vouchers' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-200">
                <div className={`h-2 bg-gradient-to-r ${getPopularityColor(voucher.popularity)}`}></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{voucher.image}</div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{voucher.brand}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          voucher.popularity === 'trending' ? 'bg-red-100 text-red-600' :
                          voucher.popularity === 'popular' ? 'bg-blue-100 text-blue-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          {getPopularityBadge(voucher.popularity)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <h4 className="font-bold text-gray-800 mb-2">{voucher.name}</h4>
                  <p className="text-gray-600 text-sm mb-4">{voucher.description}</p>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{voucher.coinsRequired}</div>
                      <div className="text-xs text-gray-500">coins required</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{voucher.value}</div>
                      <div className="text-xs text-gray-500">voucher value</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mb-4">
                    <span>Valid: {voucher.validity}</span>
                    <span>{voucher.category}</span>
                  </div>

                  <button
                    onClick={() => handleRedeem(voucher)}
                    disabled={coins < voucher.coinsRequired}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                      coins >= voucher.coinsRequired
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {coins >= voucher.coinsRequired ? 'Redeem Now 🎁' : 'Need More Coins'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            {/* Category Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-4 rounded-2xl text-center transition-all ${
                    selectedCategory === category.id
                      ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                      : 'bg-white text-gray-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <div className="font-semibold text-sm">{category.name}</div>
                  <div className="text-xs opacity-75">{category.count} items</div>
                </button>
              ))}
            </div>

            {/* Vouchers Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVouchers.map((voucher) => (
                <div key={voucher.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className={`h-2 bg-gradient-to-r ${getPopularityColor(voucher.popularity)}`}></div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">{voucher.image}</div>
                      <div>
                        <h3 className="font-bold text-gray-900">{voucher.brand}</h3>
                        <p className="text-sm text-gray-600">{voucher.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-2xl font-bold text-yellow-600">{voucher.coinsRequired}</span>
                      <span className="text-lg font-bold text-green-600">{voucher.value}</span>
                    </div>

                    <button
                      onClick={() => handleRedeem(voucher)}
                      disabled={coins < voucher.coinsRequired}
                      className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                        coins >= voucher.coinsRequired
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {coins >= voucher.coinsRequired ? 'Redeem Voucher' : 'Need More Coins'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'earn' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {earningMethods.map((method) => (
              <div key={method.method} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600">
                    {method.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{method.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <lucide.Coins size={16} className="text-yellow-500" />
                      <span className="font-semibold text-yellow-600">+{method.coins}</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4">{method.description}</p>
                <button
                  onClick={method.action}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  Earn Now
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works 🎯</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="text-3xl mb-2">💪</div>
              <h3 className="font-bold text-gray-900 mb-2">1. Learn & Practice</h3>
              <p className="text-gray-600">Solve problems, join contests, complete lessons</p>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🪙</div>
              <h3 className="font-bold text-gray-900 mb-2">2. Earn Coins</h3>
              <p className="text-gray-600">Get coins for every learning activity</p>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🎁</div>
              <h3 className="font-bold text-gray-900 mb-2">3. Redeem Rewards</h3>
              <p className="text-gray-600">Exchange coins for real brand vouchers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinShop;