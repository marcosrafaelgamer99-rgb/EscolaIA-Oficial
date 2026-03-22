import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  calcInput: string;
  handleCalcClick: (btn: string) => void;
}

export default function CalculatorModal({ isOpen, onClose, calcInput, handleCalcClick }: CalculatorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="absolute top-36 md:top-24 right-4 md:right-[5.5rem] z-50 w-64 elite-glass rounded-[24px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-white/5"
        >
          <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calculator size={14} className="text-emerald-400" /> Calculadora
            </span>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 bg-[#0a0a0a]/90 backdrop-blur-sm">
            <div className="w-full bg-black/60 rounded-xl p-3 mb-4 text-right font-mono text-xl text-emerald-400 h-14 flex items-center justify-end overflow-hidden border border-white/5 shadow-inner">
              {calcInput || '0'}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '**', '='].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleCalcClick(btn)}
                  className={cn(
                    "p-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center min-w-[44px] min-h-[44px]",
                    btn === '=' ? "bg-emerald-glow text-black col-span-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:brightness-110" :
                    ['C', '/', '*', '-', '+', '(', ')', '**'].includes(btn) ? "bg-white/10 text-emerald-400 hover:bg-white/20 hover:text-emerald-300" :
                    "bg-white/5 text-white hover:bg-white/10"
                  )}
                >
                  {btn === '**' ? '^' : btn}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
