// src/components/ScratchCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ScratchCardProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
}

export default function ScratchCard({ isOpen, onClose, coins }: ScratchCardProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative mx-4 max-w-md w-full"
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 p-1">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-white/20 text-white hover:bg-white/30"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="rounded-lg bg-white p-6 text-center">
                {/* Header */}
                <div className="mb-6">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500">
                    <Gift className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🎉 Welcome to Beta 2! 🎉
                  </h2>
                  <p className="text-gray-600">
                    Thank you for being an early user!
                  </p>
                </div>

                {/* Coin Display */}
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6 p-6 bg-gradient-to-br from-amber-200 to-yellow-300 rounded-2xl border-4 border-amber-300"
                >
                  <div className="flex items-center justify-center mb-3">
                    <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                  </div>
                  <div className="text-5xl font-bold text-gray-900 mb-2">
                    {coins} Coins
                  </div>
                  <div className="text-xl font-semibold text-amber-700">
                    FREE GIFT!
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Use these coins to generate amazing test papers
                  </p>
                </motion.div>

                {/* Claim Button */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-lg text-lg shadow-lg"
                  >
                    🎊 Claim {coins} Free Coins! 🎊
                  </Button>
                </motion.div>

                {/* Note */}
                <p className="text-xs text-gray-500 mt-3">
                  *This is a special gift for our beta users
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}