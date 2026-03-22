import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Loader2, Sparkles, Calculator, Image as ImageIcon, X, ExternalLink, Copy, Check, RotateCcw, StickyNote, ArrowRightLeft } from 'lucide-react';
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
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [maxGrade, setMaxGrade] = useState(() => localStorage.getItem('escolaia_max_grade') || '10');
  const [maxSources, setMaxSources] = useState(() => localStorage.getItem('escolaia_max_sources') || '3');
  const [schoolYear, setSchoolYear] = useState(() => localStorage.getItem('escolaia_school_year') || '9º ano do Ensino Fundamental');
  const [studyIntensity, setStudyIntensity] = useState(() => parseInt(localStorage.getItem('escolaia_study_intensity') || '50'));
  const [studyDepth, setStudyDepth] = useState(() => localStorage.getItem('escolaia_study_depth') || 'normal');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('escolaia_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isKeyValidating, setIsKeyValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [successMessageId, setSuccessMessageId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New features state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroActive, setIsPomodoroActive] = useState(false);
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

  useEffect(() => { localStorage.setItem('escolaia_max_grade', maxGrade); }, [maxGrade]);
  useEffect(() => { localStorage.setItem('escolaia_max_sources', maxSources); }, [maxSources]);
  useEffect(() => { localStorage.setItem('escolaia_school_year', schoolYear); }, [schoolYear]);
  useEffect(() => { localStorage.setItem('escolaia_study_intensity', studyIntensity.toString()); }, [studyIntensity]);
  useEffect(() => { localStorage.setItem('escolaia_study_depth', studyDepth); }, [studyDepth]);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPomodoroActive && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroTime === 0) {
      setIsPomodoroActive(false);
    }
    return () => clearInterval(interval);
  }, [isPomodoroActive, pomodoroTime]);

  const togglePomodoro = () => setIsPomodoroActive(!isPomodoroActive);
  const resetPomodoro = () => {
    setIsPomodoroActive(false);
    setPomodoroTime(25 * 60);
  };
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      await chatWithAI('Oi', [], undefined, false, schoolYear, undefined, customApiKey.trim(), modelType);
      setKeyStatus('success');
      setTimeout(() => setShowApiKeyInput(false), 1500);
    } catch (err) {
      setKeyStatus('error');
    } finally {
      setIsKeyValidating(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({
          data: (reader.result as string).split(',')[1],
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
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
    if ((!textToSend.trim() && !selectedImage) || isLoading) return;
    
    if (toolPrompt) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
    }

    let finalPrompt = textToSend;
    if (textToSend.includes('[MAX_GRADE]')) finalPrompt = textToSend.replace('[MAX_GRADE]', maxGrade);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalPrompt,
      image: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await chatWithAI(
        finalPrompt, 
        history, 
        currentImage || undefined, 
        finalPrompt.includes('MODO PESQUISA ATIVADO'), 
        schoolYear, 
        finalPrompt.includes('MODO ESTUDAR ATIVADO') ? { intensity: studyIntensity, depth: studyDepth } : undefined,
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
      
      if (currentImage) {
        setSuccessMessageId(userMessage.id);
        setTimeout(() => setSuccessMessageId(null), 3000);
      }
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
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-6 font-sans overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />
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
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg text-white outline-none focus:border-emerald-glow transition-all duration-500"
              />
              <button 
                type="submit"
                className="w-full bg-emerald-glow text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
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
      "flex h-screen bg-[#050505] overflow-hidden font-sans relative",
      isFlashing && "selection-flash"
    )}>
      {/* Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.08)_0%,transparent_50%)] pointer-events-none" />
      
      <main className="flex-1 flex flex-col relative w-full h-full">
        {/* Top bar with Model Selector */}
        <div className="flex items-center justify-between px-8 py-6 z-50">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-black tracking-tighter logo-gradient">EscolaIA v3.0</h1>
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setModelType('normal')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  modelType === 'normal' ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"
                )}
              >
                Normal
              </button>
              <button 
                onClick={() => setModelType('pro')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  modelType === 'pro' ? "bg-emerald-glow text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-slate-500 hover:text-white"
                )}
              >
                {modelType === 'pro' && <Sparkles size={10} />}
                v3.0 Pro
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={clearChat} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 md:px-0 space-y-12 no-scrollbar"
        >
          <div className="max-w-[800px] mx-auto py-12">
            {messages.length === 0 ? (
              <div className="space-y-20 py-20">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <h2 className="text-5xl md:text-7xl font-display font-black text-white tracking-tighter leading-[0.9]">
                    No que posso te <br />
                    <span className="logo-gradient">ajudar hoje?</span>
                  </h2>
                  <p className="text-slate-500 text-lg max-w-md font-medium">
                    A IA mais preparada para o 8º e 9º ano. <br />
                    Foco total no seu aprendizado.
                  </p>
                </motion.div>

                {/* Elite Bento Grid Tools */}
                <div className="grid grid-cols-1 md:grid-cols-6 grid-rows-2 gap-4 h-[400px]">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setIsCalculatorOpen(true)}
                    className="md:col-span-3 md:row-span-2 bento-card p-8 flex flex-col justify-between cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-glow/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calculator className="text-emerald-glow" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white mb-2">Calculadora Científica</h3>
                      <p className="text-slate-500 text-xs font-medium">Fórmulas complexas e resultados instantâneos para matemática e física.</p>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setIsNotesOpen(true)}
                    className="md:col-span-3 bento-card p-6 flex items-center gap-6 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <StickyNote className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Notas Rápidas</h3>
                      <p className="text-slate-500 text-[10px] font-medium tracking-wide">Salve seus insights sem sair do chat.</p>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="md:col-span-1 bento-card p-4 flex flex-col items-center justify-center gap-3 cursor-pointer group"
                    onClick={() => setIsConverterOpen(true)}
                  >
                    <ArrowRightLeft className="text-purple-400 group-hover:scale-110 transition-transform" size={20} />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Conversor</span>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="md:col-span-2 bento-card p-4 flex flex-col justify-center cursor-pointer group"
                    onClick={() => handleSend("Plano de estudos para a próxima prova.")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Sparkles className="text-amber-400" size={16} />
                      </div>
                      <span className="text-xs font-black text-white uppercase tracking-tight">Estudo Pro</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
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
                        "max-w-[85%] space-y-4",
                        m.role === 'user' ? "text-right" : "text-left"
                      )}>
                        {m.image && (
                          <div className="inline-block rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                            <img src={m.image} alt="Upload" className="max-h-60 w-auto" />
                          </div>
                        )}
                        <div className={cn(
                          "p-6 md:p-8 rounded-[2rem] transition-all duration-500",
                          m.role === 'user' 
                            ? "bg-white/5 border border-white/10 text-white font-medium shadow-xl" 
                            : "bg-transparent text-slate-300 font-light text-lg leading-relaxed",
                          isLoading && messages[messages.length - 1].id === m.id && "opacity-50"
                        )}>
                          <div className="markdown-body">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        </div>
                        {m.role === 'model' && (
                          <div className="flex gap-4 px-2">
                            <button onClick={() => copyToClipboard(m)} className="text-[10px] font-black uppercase text-slate-600 hover:text-white transition-colors tracking-[0.2em]">
                              {copiedId === m.id ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <div className="flex gap-2 p-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-glow animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-glow animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-glow animate-bounce delay-200" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* iOS Floating Input */}
        <div className="w-full max-w-[800px] mx-auto p-8 relative">
          <div className="relative group">
            {selectedImage && (
              <div className="absolute -top-24 left-4 p-2 bento-card">
                <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="preview" className="h-16 w-16 object-cover rounded-xl" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg">
                  <X size={10} />
                </button>
              </div>
            )}
            
            <div className="ios-input-container p-2 flex items-center gap-2 group-focus-within:border-emerald-glow/40 transition-all duration-700">
              <button onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-500 hover:text-emerald-glow transition-colors">
                <ImageIcon size={22} />
              </button>
              <input 
                type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*"
              />
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte qualquer coisa..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-white text-lg placeholder:text-slate-600"
              />
              <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className={cn(
                  "p-4 rounded-full transition-all duration-500",
                  input.trim() || selectedImage ? "bg-emerald-glow text-black scale-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-slate-700 scale-90"
                )}
              >
                <Send size={22} className="rotate-[-10deg] group-hover:rotate-0 transition-transform" />
              </button>
            </div>
          </div>
          
          <p className="text-center mt-6 text-[10px] text-slate-700 font-black uppercase tracking-[0.4em]">
            © 2026 EscolaIA | v3.0
          </p>
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
