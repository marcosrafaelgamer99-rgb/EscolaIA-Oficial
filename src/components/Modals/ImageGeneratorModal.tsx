import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImagePlus, Sparkles, X } from 'lucide-react';

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  handleSend: (prompt: string) => void;
}

export default function ImageGeneratorModal({
  isOpen, onClose, imagePrompt, setImagePrompt, handleSend
}: ImageGeneratorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ImagePlus size={16} className="text-blue-400" /> Gerador de Imagens
              </span>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 bg-bg-deep/90 space-y-4">
              <p className="text-xs text-slate-400">
                Descreva o diagrama, mapa mental ou modelo técnico que você deseja visualizar. 
                <span className="text-amber-500/80 block mt-1">Imagens não-educacionais e humanos realistas são proibidos.</span>
              </p>
              <textarea 
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Ex: Diagrama da célula animal com suas organelas..."
                className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-base text-slate-300 focus:outline-none focus:border-blue-500/50 resize-none h-24 pb-safe"
              />
              <button 
                onClick={() => {
                  if(imagePrompt.trim()) {
                    handleSend(`Gere uma imagem educacional sobre: ${imagePrompt}`);
                    setImagePrompt('');
                    onClose();
                  }
                }}
                disabled={!imagePrompt.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-colors uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
              >
                <Sparkles size={16} /> Gerar Mídia Mágica
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
