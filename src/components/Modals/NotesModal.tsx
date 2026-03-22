import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StickyNote, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickNotes: string;
  setQuickNotes: (v: string) => void;
}

export default function NotesModal({ isOpen, onClose, quickNotes, setQuickNotes }: NotesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className="absolute top-48 md:top-40 right-4 md:right-[5.5rem] z-50 w-80 cristal-fume rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <StickyNote size={14} className="text-slate-500" /> Notas
            </span>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
          <div className="p-6 bg-black">
            <textarea
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              placeholder="Suas anotações rápidas da aula aqui..."
              className="w-full h-40 bg-black/40 text-base text-slate-300 placeholder:text-slate-600 border border-white/5 rounded-xl p-3 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
