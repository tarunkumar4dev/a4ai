// src/components/ScratchCard.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Gift, Coins } from "lucide-react";

interface ScratchCardProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
}

const ScratchCard = ({ isOpen, onClose, coins }: ScratchCardProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 max-w-sm w-full mx-auto shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center text-white">
              <div className="flex justify-center mb-4">
                <div className="bg-white/20 p-4 rounded-full">
                  <Gift size={40} className="text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-2">🎉 Congratulations!</h2>
              
              <p className="text-lg mb-6">
                You've received <strong>{coins} FREE Coins</strong>!
              </p>

              <div className="bg-white/20 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-center gap-3">
                  <Coins className="text-yellow-300" size={32} />
                  <span className="text-3xl font-bold text-white">{coins}</span>
                </div>
                <p className="text-sm text-white/80 mt-2">FREE COINS</p>
              </div>

              <Button
                onClick={onClose}
                className="w-full bg-white text-orange-600 hover:bg-gray-100 font-bold py-3 rounded-full text-lg"
              >
                Start Exploring! 🚀
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScratchCard;