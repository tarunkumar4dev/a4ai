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
      case 'trending': return 'from-orange-500 to-red-500';
      case 'popular': return 'from-orange-400 to-amber-500';
      default: return 'from-amber-400 to-orange-400';
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-8 font-jakarta">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-jakarta">🎁 Reward Store</h1>
          <div className="bg-white rounded-2xl shadow-lg p-6 inline-block border border-orange-100">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-full p-3 shadow-lg shadow-orange-200">
                <lucide.Coins size={32} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-gray-600 text-sm font-jakarta">Your Coin Balance</p>
                <p className="text-3xl font-bold text-gray-900 font-jakarta">{coins.toLocaleString()} coins</p>
                <p className="text-sm text-orange-600 font-semibold font-jakarta">Redeem for real vouchers!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-lg border border-orange-100">
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all font-jakarta ${
                activeTab === 'vouchers' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
              }`}
              onClick={() => setActiveTab('vouchers')}
            >
              🎯 Redeem Vouchers
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all font-jakarta ${
                activeTab === 'categories' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
              }`}
              onClick={() => setActiveTab('categories')}
            >
              🛍️ By Category
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all font-jakarta ${
                activeTab === 'earn' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
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
              <div key={voucher.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-orange-100 hover:border-orange-200 hover:scale-[1.02]">
                <div className={`h-2 bg-gradient-to-r ${getPopularityColor(voucher.popularity)}`}></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{voucher.image}</div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 font-jakarta">{voucher.brand}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          voucher.popularity === 'trending' ? 'bg-orange-100 text-orange-600' :
                          voucher.popularity === 'popular' ? 'bg-amber-100 text-amber-600' :
                          'bg-green-100 text-green-600'
                        } font-jakarta`}>
                          {getPopularityBadge(voucher.popularity)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <h4 className="font-bold text-gray-800 mb-2 font-jakarta">{voucher.name}</h4>
                  <p className="text-gray-600 text-sm mb-4 font-jakarta">{voucher.description}</p>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-2xl font-bold text-orange-500 font-jakarta">{voucher.coinsRequired}</div>
                      <div className="text-xs text-gray-500 font-jakarta">coins required</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-600 font-jakarta">{voucher.value}</div>
                      <div className="text-xs text-gray-500 font-jakarta">voucher value</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mb-4 font-jakarta">
                    <span>Valid: {voucher.validity}</span>
                    <span className="capitalize">{voucher.category}</span>
                  </div>

                  <button
                    onClick={() => handleRedeem(voucher)}
                    disabled={coins < voucher.coinsRequired}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all font-jakarta ${
                      coins >= voucher.coinsRequired
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg hover:shadow-orange-200 hover:scale-[1.02]'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                  className={`p-4 rounded-2xl text-center transition-all font-jakarta ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200 transform scale-105'
                      : 'bg-white text-gray-700 shadow-md hover:shadow-lg hover:border-orange-200 border border-transparent'
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
                <div key={voucher.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-orange-100 hover:border-orange-200 hover:scale-[1.02]">
                  <div className={`h-2 bg-gradient-to-r ${getPopularityColor(voucher.popularity)}`}></div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">{voucher.image}</div>
                      <div>
                        <h3 className="font-bold text-gray-900 font-jakarta">{voucher.brand}</h3>
                        <p className="text-sm text-gray-600 font-jakarta">{voucher.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-2xl font-bold text-orange-500 font-jakarta">{voucher.coinsRequired}</span>
                      <span className="text-lg font-bold text-amber-600 font-jakarta">{voucher.value}</span>
                    </div>

                    <button
                      onClick={() => handleRedeem(voucher)}
                      disabled={coins < voucher.coinsRequired}
                      className={`w-full py-3 px-4 rounded-xl font-semibold transition-all font-jakarta ${
                        coins >= voucher.coinsRequired
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg hover:shadow-orange-200 hover:scale-[1.02]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
              <div key={method.method} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-orange-100 hover:border-orange-200 hover:scale-[1.02]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg text-orange-600">
                    {method.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 font-jakarta">{method.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <lucide.Coins size={16} className="text-orange-500" />
                      <span className="font-semibold text-orange-500 font-jakarta">+{method.coins}</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4 font-jakarta">{method.description}</p>
                <button
                  onClick={method.action}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg font-semibold hover:shadow-lg hover:shadow-orange-200 transition-all font-jakarta hover:scale-[1.02]"
                >
                  Earn Now
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-2xl shadow-lg p-6 border border-orange-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-jakarta">How It Works 🎯</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="text-3xl mb-2">💪</div>
              <h3 className="font-bold text-gray-900 mb-2 font-jakarta">1. Learn & Practice</h3>
              <p className="text-gray-600 font-jakarta">Solve problems, join contests, complete lessons</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="text-3xl mb-2">🪙</div>
              <h3 className="font-bold text-gray-900 mb-2 font-jakarta">2. Earn Coins</h3>
              <p className="text-gray-600 font-jakarta">Get coins for every learning activity</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="text-3xl mb-2">🎁</div>
              <h3 className="font-bold text-gray-900 mb-2 font-jakarta">3. Redeem Rewards</h3>
              <p className="text-gray-600 font-jakarta">Exchange coins for real brand vouchers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinShop;