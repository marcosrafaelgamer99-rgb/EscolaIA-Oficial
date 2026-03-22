import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Sparkles, Calculator, X, Copy, RotateCcw, StickyNote, ArrowRightLeft } from 'lucide-react';
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('escolaia_authenticated') === 'true';
  });
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('escolaia_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('escolaia_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isKeyValidating, setIsKeyValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
    return (localStorage.getItem('escolaia_model_type') as 'normal' | 'pro') || 'pro';
  });

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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('escolaia_api_key', customApiKey.trim());
  }, [customApiKey]);

  useEffect(() => {
    localStorage.setItem('escolaia_chat_history', JSON.stringify(messages));
  }, [messages]);

  const validateApiKey = async () => {
    if (!customApiKey.trim()) return;
    setIsKeyValidating(true);
    setKeyStatus('idle');
    try {
      await chatWithAI('Oi', [], undefined, false, '9º ano', undefined, customApiKey.trim(), modelType);
      setKeyStatus('success');
      setTimeout(() => setShowApiKeyInput(false), 1500);
    } catch (err) {
      setKeyStatus('error');
    } finally {
      setIsKeyValidating(false);
    }
  };

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
        undefined, 
        false, 
        '9º ano',
        undefined,
        customApiKey.trim(),
        modelType
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
        content: `Ops! Algo deu errado. Verifique sua conexão ou chave API.`,
      }]);
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

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const code = authCode.trim().toUpperCase();
    if (AUTHORIZED_CODES[code]) {
      localStorage.setItem('escolaia_authenticated', 'true');
      setIsAuthenticated(true);
    } else {
      setAuthError('Código inválido');
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-sans overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.03)_0%,transparent_70%)] pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bento-card p-10 text-center"
        >
          <div className="space-y-6">
            <h1 className="text-4xl font-display font-black tracking-tighter logo-gradient">EscolaIA</h1>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-black">Acesso Premium</p>
            
            <form onSubmit={handleAuth} className="space-y-6">
              <input 
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Código de Acesso"
                className="w-full bg-white/5 border border-white/10 rounded-[16px] px-6 py-4 text-center text-lg text-white outline-none focus:border-emerald-glow transition-all duration-500"
              />
              <button 
                type="submit"
                className="w-full bg-emerald-glow text-black font-black py-4 rounded-[16px] hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              >
                ENTRAR
              </button>
            </form>
            {authError && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">{authError}</p>}
          </div>
        </motion.div>
      </div>
    );
  }


  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className={cn(
      "flex h-screen bg-[#0a0a0a] overflow-hidden font-sans relative",
      isFlashing && "selection-flash"
    )}>
      {/* Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.04)_0%,transparent_50%)] pointer-events-none" />
      
      <main className="flex-1 flex flex-col relative w-full h-full">
        {/* Top bar with Model Selector */}
        <div className="flex items-center justify-between px-8 py-5 z-50 border-b border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-display font-black tracking-tighter logo-gradient">EscolaIA</h1>
          </div>
          
          <div className="flex gap-3 items-center">
            <div className="flex bg-white/5 p-1.5 rounded-lg border border-white/10 gap-1">
              <button 
                onClick={() => setModelType('normal')}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all duration-300",
                  modelType === 'normal' ? "bg-white/15 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Normal
              </button>
              <button 
                onClick={() => setModelType('pro')}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all duration-300 flex items-center gap-1.5",
                  modelType === 'pro' ? "bg-emerald-glow text-black shadow-[0_0_12px_rgba(16,185,129,0.2)]" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {modelType === 'pro' && <Sparkles size={9} />}
                Pro
              </button>
            </div>
            <button onClick={clearChat} className="p-2 text-slate-500 hover:text-emerald-glow transition-colors duration-300">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-0 space-y-8 no-scrollbar pb-4"
        >
          <div className="max-w-[900px] mx-auto w-full py-10 md:py-12">
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
                    className="md:col-span-1 md:row-span-2 bento-card p-6 md:p-8 flex flex-col justify-between cursor-pointer group h-auto md:h-[280px] text-left hover:border-emerald-glow/20 transition-all duration-300"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-glow/15 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-300">
                      <Calculator className="text-emerald-glow" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-black text-white mb-1.5">Calculadora</h3>
                      <p className="text-slate-400 text-xs md:text-sm font-light">Científica e completa</p>
                    </div>
                  </motion.button>

                  {/* Notas */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsNotesOpen(true)}
                    className="bento-card p-6 md:p-8 flex flex-col justify-between cursor-pointer group text-left hover:border-blue-400/20 transition-all duration-300"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-300">
                      <StickyNote className="text-blue-400" size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white mb-1">Notas</h3>
                      <p className="text-slate-400 text-xs font-light">Rápidas e offline</p>
                    </div>
                  </motion.button>

                  {/* Conversor */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="bento-card p-6 md:p-8 flex flex-col justify-between cursor-pointer group text-left hover:border-purple-400/20 transition-all duration-300"
                    onClick={() => setIsConverterOpen(true)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-300">
                      <ArrowRightLeft className="text-purple-400" size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white mb-1">Conversor</h3>
                      <p className="text-slate-400 text-xs font-light">Unidades e medidas</p>
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
                          "p-4 md:p-5 rounded-[20px] transition-all duration-300",
                          m.role === 'user' 
                            ? "bg-emerald-glow/12 border border-emerald-glow/20 text-white font-medium" 
                            : "bg-transparent text-slate-300 font-light text-base leading-[1.6]",
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

        {/* Input Bar - Fixed Bottom */}
        <div className="w-full bg-black/30 backdrop-blur-sm border-t border-white/5 sticky bottom-0">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 py-4">
            <div className="relative group">
              <div className="ios-input-container p-3.5 flex items-center gap-3 group-focus-within:border-emerald-glow/30 group-focus-within:shadow-[0_0_20px_rgba(16,185,129,0.08)] transition-all duration-300">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pergunte qualquer coisa..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-white text-sm md:text-base placeholder:text-slate-500 outline-none"
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-2.5 md:p-3 rounded-full transition-all duration-300",
                    input.trim() ? "bg-emerald-glow text-black scale-100 shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]" : "text-slate-700 scale-90 cursor-not-allowed"
                  )}
                >
                  <Send size={18} className="rotate-[-10deg] group-hover:rotate-0 transition-transform duration-300" />
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
