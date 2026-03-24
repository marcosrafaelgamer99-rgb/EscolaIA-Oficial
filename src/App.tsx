import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Sparkles, Calculator, X, Copy, RotateCcw, StickyNote, ArrowRightLeft, ChevronDown, Check, Search, BookOpen, Smile, BarChart3, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI } from './services/gemini';
import { AUTHORIZED_CODES } from './codigos';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const CalculatorModal = lazy(() => import('./components/Modals/CalculatorModal'));
const NotesModal = lazy(() => import('./components/Modals/NotesModal'));
const ConverterModal = lazy(() => import('./components/Modals/ConverterModal'));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string;
  sources?: { title: string, uri: string }[];
}

const Typewriter = ({ text, delay = 100 }: { text: string, delay?: number }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return <span className="typewriter-cursor">{currentText}</span>;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('escolaia_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New features state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [quickNotes, setQuickNotes] = useState(() => localStorage.getItem('escolaia_quick_notes') || '');
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [convValue, setConvValue] = useState('');
  const [convType, setConvType] = useState('m_cm');
  const [convResult, setConvResult] = useState('');
  const [modelType, setModelType] = useState<'normal' | 'pro'>(() => {
    // Forçamos o modo normal inicialmente já que o Pro está bloqueado
    return 'normal';
  });
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [behaviorHumanized, setBehaviorHumanized] = useState(false);
  const [behaviorAnalytic, setBehaviorAnalytic] = useState(false);
  const [schoolYear, setSchoolYear] = useState(() => {
    return localStorage.getItem('escolaia_school_year') || '9º Ano';
  });

  useEffect(() => {
    localStorage.setItem('escolaia_school_year', schoolYear);
  }, [schoolYear]);

  useEffect(() => {
    localStorage.setItem('escolaia_model_type', modelType);
  }, [modelType]);

  useEffect(() => {
    localStorage.setItem('escolaia_quick_notes', quickNotes);
  }, [quickNotes]);

  const handleConvert = () => {
    const val = parseFloat(convValue);
    if (isNaN(val)) return setConvResult('Valor inválido');
    switch (convType) {
      case 'm_cm': setConvResult(`${val * 100} cm`); break;
      case 'cm_m': setConvResult(`${val / 100} m`); break;
      case 'km_m': setConvResult(`${val * 1000} m`); break;
      case 'c_f': setConvResult(`${((val * 9/5) + 32).toFixed(1)} °F`); break;
      case 'f_c': setConvResult(`${((val - 32) * 5/9).toFixed(1)} °C`); break;
      case 'kg_g': setConvResult(`${val * 1000} g`); break;
      default: setConvResult('---');
    }
  };

  const handleCalcClick = (val: string) => {
    if (val === '=') {
      try {
        // eslint-disable-next-line no-eval
        setCalcInput(eval(calcInput).toString());
      } catch {
        setCalcInput('Erro');
      }
    } else if (val === 'C') {
      setCalcInput('');
    } else {
      setCalcInput((prev) => prev + val);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame para garantir que o DOM foi atualizado antes de rolar
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isLoading]);


  useEffect(() => {
    localStorage.setItem('escolaia_chat_history', JSON.stringify(messages));
  }, [messages]);

  const copyToClipboard = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSend = async (toolPrompt?: string) => {
    const textToSend = toolPrompt ? `${toolPrompt}\n\n${input}` : input;
    if (!textToSend.trim() || isLoading) return;
    
    if (toolPrompt) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await chatWithAI(
        textToSend, 
        history, 
        undefined, // image
        false,     // useSearch
        schoolYear, // schoolYear
        undefined, // studyConfig
        undefined, // customApiKey (Automated)
        modelType,
        { humanized: behaviorHumanized, analytic: behaviorAnalytic }
      );
      
      let finalContent = response.text || 'Desculpe, tive um problema ao processar sua resposta.';
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: finalContent,
        sources: response.sources
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Ops! Algo deu errado ao processar sua mensagem. ${error.message || ''}`,
      }]);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Limpar histórico?')) {
      setMessages([]);
      localStorage.removeItem('escolaia_chat_history');
    }
  };

  return (
    <div className={cn(
      "flex h-[100dvh] bg-[#0a0a0a] overflow-hidden font-sans relative",
      isFlashing && "selection-flash"
    )}>
      {/* Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.04)_0%,transparent_50%)] pointer-events-none" />
      
      <main className="flex-1 flex flex-col relative w-full h-full">
        <div className="flex items-center justify-between px-8 py-5 z-50 border-b border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            {/* Unified Title */}
            <div className="flex items-baseline">
              <span className="text-xl font-display font-black tracking-tighter logo-gradient">EscolaIA</span>
              <span className="text-slate-500 font-bold text-[11px] ml-1.5 tracking-widest uppercase">v3.0</span>
              {modelType === 'pro' && (
                <span className="ml-2 text-xl font-display font-black tracking-tighter logo-gradient">Pro</span>
              )}
            </div>
            
            <select 
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 outline-none focus:border-emerald-glow/30 transition-all cursor-pointer hover:bg-white/10"
            >
              <option value="6º Ano" className="bg-[#0a0a0a]">6º Ano</option>
              <option value="7º Ano" className="bg-[#0a0a0a]">7º Ano</option>
              <option value="8º Ano" className="bg-[#0a0a0a]">8º Ano</option>
              <option value="9º Ano" className="bg-[#0a0a0a]">9º Ano</option>
              <option value="Ensino Médio" className="bg-[#0a0a0a]">Ensino Médio</option>
            </select>
          </div>
          
          <div className="flex gap-3 items-center">
            <button onClick={clearChat} className="p-2 text-slate-500 hover:text-emerald-glow transition-colors duration-300">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-0 space-y-8 no-scrollbar pb-4"
        >
          <div className="max-w-[850px] mx-auto w-full py-10 md:py-12">
            {messages.length === 0 ? (
              <div className="space-y-12 py-12 md:py-20">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 px-4 md:px-0"
                >
                  <h2 className="text-5xl md:text-6xl font-display font-black text-white tracking-tight leading-[1.1]">
                    No que posso te <br />
                    <span className="logo-gradient">ajudar?</span>
                  </h2>
                  <p className="text-slate-400 text-sm md:text-base max-w-xl font-light leading-relaxed">
                    A IA mais preparada para você. Acesso ao melhor conhecimento em qualquer momento.
                  </p>
                </motion.div>

                {/* Bento Grid - Premium Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 px-4 md:px-0">
                  {/* Calculadora - Featured */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsCalculatorOpen(true)}
                    className="md:col-span-1 md:row-span-2 bento-card p-10 md:p-12 flex flex-col justify-between cursor-pointer group h-auto md:h-[320px] text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-glow/10 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-500">
                      <Calculator className="text-emerald-glow/80" size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-white mb-2">Calculadora</h3>
                      <p className="text-slate-500 text-xs md:text-sm font-light">Científica e completa</p>
                    </div>
                  </motion.button>

                  {/* Notas */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsNotesOpen(true)}
                    className="bento-card p-10 md:p-12 flex flex-col justify-between cursor-pointer group text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-500">
                      <StickyNote className="text-slate-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white mb-2">Notas</h3>
                      <p className="text-slate-500 text-xs font-light">Rápidas e offline</p>
                    </div>
                  </motion.button>

                  {/* Conversor */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="bento-card p-10 md:p-12 flex flex-col justify-between cursor-pointer group text-left"
                    onClick={() => setIsConverterOpen(true)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-500">
                      <ArrowRightLeft className="text-slate-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white mb-2">Conversor</h3>
                      <p className="text-slate-500 text-xs font-light">Unidades e medidas</p>
                    </div>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 px-4 md:px-0">
                <AnimatePresence mode="popLayout">
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex w-full",
                        m.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] md:max-w-[75%] space-y-2.5",
                        m.role === 'user' ? "text-right" : "text-left"
                      )}>
                        <div className={cn(
                          "p-6 md:p-8 rounded-[28px] transition-all duration-500",
                          m.role === 'user' 
                            ? "bg-white/5 border border-white/10 text-white font-medium" 
                            : "cristal-fume text-slate-300 font-light text-base leading-[1.7]",
                          isLoading && messages[messages.length - 1].id === m.id && "opacity-50"
                        )}>
                          <div className="markdown-body">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        </div>
                        {m.role === 'model' && (
                          <div className="flex gap-4 px-2">
                            <button onClick={() => copyToClipboard(m)} className="text-[10px] font-bold uppercase text-slate-600 hover:text-emerald-glow transition-colors duration-300 tracking-wide">
                              {copiedId === m.id ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <div className="flex gap-1.5 p-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-glow animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-emerald-glow animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-emerald-glow animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Integrated Writing Bar - Modern AI Style */}
        <div className="w-full fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-[850px] mx-auto px-6 pointer-events-auto relative">
            
            {/* Tools Pop-over Menu */}
            <AnimatePresence>
              {isToolsMenuOpen && (
                <>
                  {/* Floating Tools Menu (Bottom Sheet on Mobile, Pop-over on Desktop) */}
                  {/* Backdrop for Mobile */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsToolsMenuOpen(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                    className="fixed bottom-0 left-0 right-0 z-50 md:absolute md:bottom-full md:left-0 md:mb-4 md:w-80 cristal-fume p-4 border border-white/10 md:rounded-3xl rounded-t-3xl rounded-b-none shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-[0_10px_40px_rgba(0,0,0,0.5)] origin-bottom-left" style={{ backdropFilter: 'blur(30px)', backgroundColor: 'rgba(30, 30, 30, 0.7)' }}
                  >
                    {/* Handle for Mobile */}
                    <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 md:hidden" />
                    <div className="space-y-6">
                      {/* Group O QUE FAZER? */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 px-2 uppercase tracking-[0.2em]">O QUE FAZER?</span>
                        <div className="grid grid-cols-1 gap-2">
                          <button 
                            onClick={() => { setInput(prev => `Responda isto: ${prev}`); setIsToolsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-emerald-glow/10 flex items-center justify-center group-hover:bg-emerald-glow group-hover:text-black transition-all">
                              <Check size={16} />
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-white">Responda</div>
                              <div className="text-[10px] text-slate-500">Respostas diretas e rápidas</div>
                            </div>
                          </button>
                          <button 
                            onClick={() => { setInput(prev => `Analise este conteúdo profundamente: ${prev}`); setIsToolsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-black transition-all">
                              <Search size={16} />
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-white">Analise</div>
                              <div className="text-[10px] text-slate-500">Explicação profunda e detalhada</div>
                            </div>
                          </button>
                          <button 
                            onClick={() => { setInput(prev => `Estude o seguinte tema: ${prev}`); setIsToolsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-black transition-all">
                              <BookOpen size={16} />
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-white">Estude</div>
                              <div className="text-[10px] text-slate-500">Planos de estudo e resumos</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Group FUNÇÕES */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 px-2 uppercase tracking-[0.2em]">FUNÇÕES</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setBehaviorHumanized(!behaviorHumanized)}
                            className={cn(
                              "flex flex-col gap-2 p-3 rounded-xl transition-all text-left border",
                              behaviorHumanized ? "bg-emerald-glow/20 border-emerald-glow/50" : "bg-white/5 border-transparent hover:bg-white/10"
                            )}
                          >
                            <Smile size={16} className={behaviorHumanized ? "text-emerald-glow" : "text-white"} />
                            <div className="text-[11px] font-bold text-white">Humanizado</div>
                          </button>
                          <button 
                            onClick={() => setBehaviorAnalytic(!behaviorAnalytic)}
                            className={cn(
                              "flex flex-col gap-2 p-3 rounded-xl transition-all text-left border",
                              behaviorAnalytic ? "bg-emerald-glow/20 border-emerald-glow/50" : "bg-white/5 border-transparent hover:bg-white/10"
                            )}
                          >
                            <BarChart3 size={16} className={behaviorAnalytic ? "text-emerald-glow" : "text-white"} />
                            <div className="text-[11px] font-bold text-white">Analítico</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* The Integrated Pill Bar */}
            <div className="cristal-fume p-2 sm:p-2.5 rounded-[32px] md:rounded-[36px] flex items-center border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative group/bar focus-within:border-emerald-glow/30 transition-all md:backdrop-blur-[25px] backdrop-blur-[15px]" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center gap-1 sm:gap-1.5 group/left">
                <button className="p-2 sm:p-3 text-emerald-glow hover:text-white transition-all hover:scale-110 active:scale-95 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0">
                  <Sparkles size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                </button>
                <button 
                  onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-[14px] sm:rounded-2xl text-[10px] sm:text-[12px] font-bold transition-all border shrink-0",
                    isToolsMenuOpen 
                      ? "bg-emerald-glow/20 text-emerald-glow border-emerald-glow/50" 
                      : "text-slate-300 hover:bg-white/10 border-transparent bg-white/5 shadow-inner"
                  )}
                >
                  <Sparkles size={14} className={cn("transition-colors w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block", isToolsMenuOpen ? "text-white" : "text-emerald-glow")} />
                  <span className="hidden sm:inline">Ferramentas</span>
                  <span className="sm:hidden">Ferram</span>
                </button>
              </div>

              <input 
                type="text"
                autoFocus={true}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte qualquer coisa..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-white text-sm placeholder:text-slate-600 outline-none px-4"
              />

              <div className="flex items-center gap-2 px-2">
                {/* Integrated Model Selector */}
                <div className="relative">
                  <button 
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                  >
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                      {modelType === 'pro' ? 'Pro' : 'v3.0'}
                    </span>
                    <ChevronDown size={12} className={cn("text-slate-500 transition-transform", isModelMenuOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isModelMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsModelMenuOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-4 w-64 z-[70] cristal-fume rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-1"
                        >
                          <button 
                            onClick={() => { setModelType('normal'); setIsModelMenuOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                              modelType === 'normal' ? "bg-white/10" : "hover:bg-white/5"
                            )}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 opacity-50" />
                            <div className="text-[11px] font-bold text-white">EscolaIA v3.0</div>
                          </button>
                          <button 
                            onClick={() => { alert('O Modo Pro está em fase de testes e chegará em breve!'); }}
                            className="w-full flex items-center justify-between p-3 rounded-xl transition-all text-left opacity-40 cursor-not-allowed group"
                          >
                            <div className="flex items-center gap-3">
                              <Lock size={12} className="text-slate-500 ml-1" />
                              <div className="text-[11px] font-bold text-slate-400">EscolaIA v3.0 Pro</div>
                            </div>
                            <span className="text-[8px] font-black bg-white/10 px-1.5 py-0.5 rounded text-white tracking-tighter">EM BREVE</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-2.5 rounded-full transition-all duration-500",
                    input.trim() ? "bg-emerald-glow text-black scale-100 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-105" : "text-slate-700 scale-95 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Suspense fallback={null}>
        <CalculatorModal 
          isOpen={isCalculatorOpen} 
          onClose={() => setIsCalculatorOpen(false)} 
          calcInput={calcInput} 
          handleCalcClick={handleCalcClick} 
        />
        <NotesModal 
          isOpen={isNotesOpen} 
          onClose={() => setIsNotesOpen(false)} 
          quickNotes={quickNotes} 
          setQuickNotes={setQuickNotes} 
        />
        <ConverterModal 
          isOpen={isConverterOpen} 
          onClose={() => setIsConverterOpen(false)} 
          convType={convType} 
          setConvType={setConvType} 
          convValue={convValue} 
          setConvValue={setConvValue} 
          convResult={convResult} 
          setConvResult={setConvResult} 
          handleConvert={handleConvert} 
        />
      </Suspense>
    </div>
  );
}
