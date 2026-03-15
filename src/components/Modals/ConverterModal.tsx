import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRightLeft, X } from 'lucide-react';

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  convType: string;
  setConvType: (v: string) => void;
  convValue: string;
  setConvValue: (v: string) => void;
  convResult: string;
  setConvResult: (v: string) => void;
  handleConvert: () => void;
}

export default function ConverterModal({
  isOpen, onClose, convType, setConvType, convValue, setConvValue, convResult, setConvResult, handleConvert
}: ConverterModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="absolute top-64 md:top-56 right-4 md:right-[5.5rem] z-50 w-64 glass-panel rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10"
        >
          <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-purple-400" /> Conversor
            </span>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 bg-bg-deep/90 backdrop-blur-xl space-y-3">
            <select 
              value={convType} 
              onChange={(e) => { setConvType(e.target.value); setConvResult(''); }}
              className="w-full bg-black/60 border border-white/5 rounded-xl px-3 py-3 text-sm text-slate-300 focus:outline-none focus:border-purple-500/50 min-h-[44px]"
            >
              <option value="m_cm">Metros → Cent. (cm)</option>
              <option value="cm_m">Cent. → Metros (m)</option>
              <option value="km_m">Km → Metros (m)</option>
              <option value="c_f">Celsius → Fahrenheit</option>
              <option value="f_c">Fahrenheit → Celsius</option>
              <option value="kg_g">Kg → Gramas (g)</option>
            </select>
            <input 
              type="number" 
              value={convValue}
              onChange={(e) => { setConvValue(e.target.value); setConvResult(''); }}
              placeholder="Valor..."
              className="w-full bg-black/60 border border-white/5 rounded-xl px-3 py-3 text-base text-slate-300 focus:outline-none focus:border-purple-500/50 min-h-[44px] pb-safe"
            />
            <button 
              onClick={handleConvert}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl py-3 transition-colors uppercase tracking-wider active:scale-95 min-h-[44px]"
            >
              Converter
            </button>
            {convResult && (
              <div className="text-center font-mono text-lg text-purple-400 pt-2 border-t border-white/5">
                {convResult}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
