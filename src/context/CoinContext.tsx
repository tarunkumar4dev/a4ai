// src/context/CoinContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Mock useAuth since we don't have the actual AuthContext
const useAuth = () => {
  return { 
    user: { 
      id: 'mock-user-id', 
      email: 'user@example.com' 
    } 
  };
};

interface CoinTransaction {
  id: string;
  userId: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  contestId?: string;
  createdAt: string;
}

interface Voucher {
  id: string;
  brand: string;
  name: string;
  description: string;
  coinsRequired: number;
  value: string;
  category: 'shopping' | 'food' | 'entertainment' | 'education' | 'gaming';
  popularity: 'trending' | 'popular' | 'regular';
  validity: string;
  image: string;
}

interface CoinContextType {
  coins: number;
  totalEarned: number;
  transactions: CoinTransaction[];
  vouchers: Voucher[];
  addCoins: (amount: number, description: string, contestId?: string) => void;
  spendCoins: (amount: number, description: string) => boolean;
  redeemVoucher: (voucherId: string) => Promise<boolean>;
  isLoading: boolean;
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

interface CoinProviderProps {
  children: ReactNode;
}

export const CoinProvider: React.FC<CoinProviderProps> = ({ children }) => {
  const [coins, setCoins] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Indian brand vouchers specifically for students
  const [vouchers] = useState<Voucher[]>([
    {
      id: 'amazon-100',
      brand: 'Amazon',
      name: 'Amazon Gift Card',
      description: '₹100 Amazon shopping voucher',
      coinsRequired: 1000,
      value: '₹100',
      category: 'shopping',
      popularity: 'trending',
      validity: '3 months',
      image: '🛍️'
    },
    {
      id: 'flipkart-150',
      brand: 'Flipkart',
      name: 'Flipkart Super Coin',
      description: '₹150 Flipkart shopping voucher',
      coinsRequired: 1200,
      value: '₹150',
      category: 'shopping',
      popularity: 'trending',
      validity: '3 months',
      image: '📦'
    },
    {
      id: 'ajio-200',
      brand: 'AJIO',
      name: 'AJIO Fashion Voucher',
      description: '₹200 AJIO fashion shopping',
      coinsRequired: 1500,
      value: '₹200',
      category: 'shopping',
      popularity: 'popular',
      validity: '2 months',
      image: '👕'
    },
    {
      id: 'myntra-250',
      brand: 'Myntra',
      name: 'Myntra Fashion Cash',
      description: '₹250 Myntra fashion voucher',
      coinsRequired: 1800,
      value: '₹250',
      category: 'shopping',
      popularity: 'popular',
      validity: '2 months',
      image: '👗'
    },
    {
      id: 'swiggy-100',
      brand: 'Swiggy',
      name: 'Swiggy Food Money',
      description: '₹100 Swiggy food delivery',
      coinsRequired: 800,
      value: '₹100',
      category: 'food',
      popularity: 'trending',
      validity: '1 month',
      image: '🍕'
    },
    {
      id: 'zomato-150',
      brand: 'Zomato',
      name: 'Zomato Dining Cash',
      description: '₹150 Zomato food voucher',
      coinsRequired: 1000,
      value: '₹150',
      category: 'food',
      popularity: 'popular',
      validity: '1 month',
      image: '🍔'
    },
    {
      id: 'book-300',
      brand: 'Amazon Books',
      name: 'Book Shopping Voucher',
      description: '₹300 for educational books',
      coinsRequired: 2000,
      value: '₹300',
      category: 'education',
      popularity: 'regular',
      validity: '6 months',
      image: '📚'
    },
    {
      id: 'byjus-500',
      brand: 'BYJU\'S',
      name: 'BYJU\'S Learning',
      description: '₹500 learning course discount',
      coinsRequired: 3000,
      value: '₹500',
      category: 'education',
      popularity: 'popular',
      validity: '6 months',
      image: '🎓'
    },
    {
      id: 'netflix-199',
      brand: 'Netflix',
      name: 'Netflix Mobile Plan',
      description: '1 month Netflix mobile plan',
      coinsRequired: 1500,
      value: '₹199',
      category: 'entertainment',
      popularity: 'trending',
      validity: '1 month',
      image: '🎬'
    },
    {
      id: 'spotify-99',
      brand: 'Spotify',
      name: 'Spotify Premium',
      description: '1 month Spotify Premium',
      coinsRequired: 800,
      value: '₹99',
      category: 'entertainment',
      popularity: 'popular',
      validity: '1 month',
      image: '🎵'
    },
    {
      id: 'pubg-200',
      brand: 'PUBG',
      name: 'PUBG UC Voucher',
      description: '200 PUBG Unknown Cash',
      coinsRequired: 1200,
      value: '200 UC',
      category: 'gaming',
      popularity: 'trending',
      validity: 'Instant',
      image: '🎮'
    },
    {
      id: 'freefire-150',
      brand: 'Free Fire',
      name: 'Free Fire Diamonds',
      description: '150 Free Fire diamonds',
      coinsRequired: 1000,
      value: '150 Diamonds',
      category: 'gaming',
      popularity: 'popular',
      validity: 'Instant',
      image: '💎'
    },
    {
      id: 'croma-500',
      brand: 'Croma',
      name: 'Croma Electronics',
      description: '₹500 electronics voucher',
      coinsRequired: 3500,
      value: '₹500',
      category: 'shopping',
      popularity: 'regular',
      validity: '3 months',
      image: '📱'
    },
    {
      id: 'bigbasket-300',
      brand: 'BigBasket',
      name: 'BigBasket Grocery',
      description: '₹300 grocery shopping',
      coinsRequired: 2000,
      value: '₹300',
      category: 'food',
      popularity: 'regular',
      validity: '2 months',
      image: '🛒'
    },
    {
      id: 'dominos-200',
      brand: 'Domino\'s',
      name: 'Domino\'s Pizza',
      description: '₹200 pizza voucher',
      coinsRequired: 1200,
      value: '₹200',
      category: 'food',
      popularity: 'popular',
      validity: '1 month',
      image: '🍕'
    }
  ]);

  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadCoinData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadCoinData = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('coins, total_coins_earned')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('No profile found, using default coins');
        setCoins(100);
        setTotalEarned(100);
      } else {
        setCoins(profile?.coins || 100);
        setTotalEarned(profile?.total_coins_earned || 100);
      }

      const { data: txData, error: txError } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!txError && txData) {
        setTransactions(txData.map(tx => ({
          id: tx.id,
          userId: tx.user_id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          contestId: tx.contest_id,
          createdAt: tx.created_at
        })));
      }
    } catch (error) {
      console.error('Error loading coin data:', error);
      setCoins(100);
      setTotalEarned(100);
    } finally {
      setIsLoading(false);
    }
  };

  const addCoins = async (amount: number, description: string, contestId?: string) => {
    if (!user) return;

    try {
      const newCoinBalance = coins + amount;
      const newTotalEarned = totalEarned + amount;

      setCoins(newCoinBalance);
      setTotalEarned(newTotalEarned);

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          coins: newCoinBalance,
          total_coins_earned: newTotalEarned,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('Error updating coins in database:', updateError);
        setCoins(coins);
        setTotalEarned(totalEarned);
        return;
      }

      const { error: txError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          type: 'earn',
          amount,
          description,
          contest_id: contestId,
          created_at: new Date().toISOString()
        });

      if (txError) {
        console.error('Error recording transaction:', txError);
      }

      await loadCoinData();
    } catch (error) {
      console.error('Error adding coins:', error);
      setCoins(coins);
      setTotalEarned(totalEarned);
    }
  };

  const spendCoins = async (amount: number, description: string): Promise<boolean> => {
    if (!user || coins < amount) return false;

    try {
      const newCoinBalance = coins - amount;
      setCoins(newCoinBalance);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          coins: newCoinBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error spending coins in database:', updateError);
        setCoins(coins);
        return false;
      }

      const { error: txError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          type: 'spend',
          amount,
          description,
          created_at: new Date().toISOString()
        });

      if (txError) {
        console.error('Error recording spend transaction:', txError);
      }

      await loadCoinData();
      return true;
    } catch (error) {
      console.error('Error spending coins:', error);
      setCoins(coins);
      return false;
    }
  };

  const redeemVoucher = async (voucherId: string): Promise<boolean> => {
    const voucher = vouchers.find(v => v.id === voucherId);
    if (!voucher || coins < voucher.coinsRequired) {
      return false;
    }

    const success = await spendCoins(voucher.coinsRequired, `Redeemed: ${voucher.name}`);
    if (success) {
      // In a real app, you would generate and send the voucher code here
      alert(`🎉 Congratulations! You've successfully redeemed ${voucher.name}!\n\nVoucher Value: ${voucher.value}\nCode will be sent to your email within 24 hours.`);
      return true;
    }
    return false;
  };

  const value: CoinContextType = {
    coins,
    totalEarned,
    transactions,
    vouchers,
    addCoins,
    spendCoins,
    redeemVoucher,
    isLoading
  };

  return (
    <CoinContext.Provider value={value}>
      {children}
    </CoinContext.Provider>
  );
};

export const useCoins = (): CoinContextType => {
  const context = useContext(CoinContext);
  if (context === undefined) {
    throw new Error('useCoins must be used within a CoinProvider');
  }
  return context;
};

export default CoinContext;