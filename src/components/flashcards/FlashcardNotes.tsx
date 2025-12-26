import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Lightbulb, MessageSquare, Clock, Bookmark } from 'lucide-react';
import { loadNotesFromLocalStorage, saveNotesToLocalStorage } from '@/data/flashcardUtils';

interface FlashcardNotesProps {
  keyPoints: string;
  comments: string;
  onKeyPointsChange: (value: string) => void;
  onCommentsChange: (value: string) => void;
  onSave: () => void;
  cardId: string;
}

export default function FlashcardNotes({
  keyPoints,
  comments,
  onKeyPointsChange,
  onCommentsChange,
  onSave,
  cardId
}: FlashcardNotesProps) {
  const [recentNotes, setRecentNotes] = useState<Array<{
    id: string;
    keyPoints: string;
    comments: string;
    timestamp: string;
  }>>([]);

  // Load saved notes for this card
  useEffect(() => {
    const savedNotes = loadNotesFromLocalStorage(cardId);
    if (savedNotes.keyPoints || savedNotes.comments) {
      onKeyPointsChange(savedNotes.keyPoints);
      onCommentsChange(savedNotes.comments);
    }
  }, [cardId, onKeyPointsChange, onCommentsChange]);

  // Load recent notes from localStorage
  useEffect(() => {
    const allNotes = JSON.parse(localStorage.getItem('flashcardNotes') || '{}');
    const recent = Object.entries(allNotes)
      .map(([id, data]: [string, any]) => ({
        id,
        keyPoints: data.keyPoints,
        comments: data.comments,
        timestamp: new Date(data.updatedAt).toLocaleDateString()
      }))
      .slice(0, 3); // Show only 3 most recent
    setRecentNotes(recent);
  }, []);

  const handleSave = () => {
    saveNotesToLocalStorage(cardId, keyPoints, comments);
    onSave();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full"
    >
      <div className="glass-effect rounded-3xl p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Bookmark className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Learning Notes</h3>
            <p className="text-sm text-slate-500">
              Capture your insights, tricks, and questions
            </p>
          </div>
        </div>

        {/* Current Card Notes */}
        <div className="space-y-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Key Points
              </span>
            </div>
            <textarea
              value={keyPoints}
              onChange={(e) => onKeyPointsChange(e.target.value)}
              placeholder="• Write important concepts...
• Add mnemonics...
• Note formulas to remember..."
              className="w-full h-32 bg-white/50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                Questions & Ideas
              </span>
            </div>
            <textarea
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="• What's confusing?
• Real-world applications?
• Connections to other topics..."
              className="w-full h-32 bg-white/50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            id="saveNotesBtn"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg transition-all"
          >
            <Save size={18} />
            Save Notes for This Card
          </motion.button>
        </div>

        {/* Recent Notes Preview */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Recent Notes
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-64 pr-2">
            {recentNotes.length > 0 ? (
              recentNotes.map((note, index) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/50 backdrop-blur-sm rounded-xl p-3 border border-slate-200 hover:border-blue-200 transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Card #{note.id.split('_')[1]}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {note.timestamp}
                    </span>
                  </div>
                  {note.keyPoints && (
                    <p className="text-xs text-slate-700 mb-1 line-clamp-2">
                      <span className="font-semibold">Key:</span> {note.keyPoints}
                    </p>
                  )}
                  {note.comments && (
                    <p className="text-xs text-slate-700 line-clamp-2">
                      <span className="font-semibold">Note:</span> {note.comments}
                    </p>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">
                  Your saved notes will appear here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Notes Tips */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            <span className="font-semibold">Tip:</span> Notes auto-save locally. Use bullet points for better retention.
          </p>
        </div>
      </div>
    </motion.div>
  );
}