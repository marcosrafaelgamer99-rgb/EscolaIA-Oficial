import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, BookOpen, Calculator, History, Globe, FlaskConical, Languages, ShieldCheck, UserCheck, Image as ImageIcon, X, FileSearch, Menu, Search, ExternalLink, Copy, Check, Key, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI } from './services/gemini';
import { AUTHORIZED_CODES } from './codigos';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const SUBJECTS = [
  { name: 'Matemática', icon: Calculator, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Preciso de ajuda com um exercício de Matemática.' },
  { name: 'Português', icon: BookOpen, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Pode me ajudar com análise sintática ou redação?' },
  { name: 'História', icon: History, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Vamos estudar História do Brasil ou Geral?' },
  { name: 'Geografia', icon: Globe, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Tenho dúvidas sobre Geografia e geopolítica.' },
  { name: 'Ciências', icon: FlaskConical, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Pode me explicar um conceito de Biologia, Física ou Química?' },
  { name: 'Inglês', icon: Languages, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', prompt: 'Help me with English grammar or vocabulary.' },
];

const SPECIAL_TOOLS = [
  { 
    label: 'Analisador Rígido', 
    icon: FileSearch, 
    color: 'from-red-500/20 to-red-900/40',
    glow: 'shadow-red-500/50',
    description: 'Crítica técnica profunda e rigorosa para excelência acadêmica.',
    prompt: 'MODO ANALISADOR RÍGIDO ATIVADO. Por favor, analise meu trabalho escolar abaixo com máximo rigor, dê uma nota e aponte todos os erros:' 
  },
  { 
    label: 'Pesquisa Acadêmica', 
    icon: Search, 
    color: 'from-emerald-500/20 to-emerald-900/40',
    glow: 'shadow-emerald-500/50',
    description: 'Busca avançada em fontes confiáveis com síntese inteligente.',
    prompt: 'MODO PESQUISA ATIVADO. Pesquise sobre o tema abaixo usando exatamente [MAX_SOURCES] fontes diferentes e mostre o que encontrou em cada uma:' 
  },
  { 
    label: 'Dar Nota', 
    icon: ShieldCheck, 
    color: 'from-blue-500/20 to-blue-900/40',
    glow: 'shadow-blue-500/50',
    description: 'Avaliação precisa baseada em critérios oficiais do MEC.',
    prompt: 'MODO NOTA ATIVADO. Analise meu trabalho e dê uma nota de 0 a [MAX_GRADE]. Seja justo e rigoroso:' 
  },
  { 
    label: 'Humanizador', 
    icon: UserCheck, 
    color: 'from-orange-500/20 to-orange-900/40',
    glow: 'shadow-orange-500/50',
    description: 'Transforme textos frios em escrita natural e envolvente.',
    prompt: 'MODO DETECTOR E HUMANIZADOR ATIVADO. Analise se o texto abaixo foi feito por IA ou Humano e depois reescreva-o para ficar MUITO humanizado:' 
  },
  { 
    label: 'Modo Estudar', 
    icon: BookOpen, 
    color: 'from-indigo-500/20 to-indigo-900/40',
    glow: 'shadow-indigo-500/50',
    description: 'Jornada de aprendizado personalizada com foco em retenção.',
    prompt: 'MODO ESTUDAR ATIVADO. Quero estudar o tema abaixo. Use intensidade [STUDY_INTENSITY] e profundidade [STUDY_DEPTH]:' 
  },
];

const QUICK_ACTIONS = [
  { label: 'Resumir Texto', icon: Sparkles, prompt: 'Pode resumir este texto para mim em tópicos principais?' },
  { label: 'Explicar Conceito', icon: BookOpen, prompt: 'Pode me explicar de forma simples o que é [insira o conceito]?' },
];

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [maxGrade, setMaxGrade] = useState('10');
  const [maxSources, setMaxSources] = useState('3');
  const [schoolYear, setSchoolYear] = useState('9º ano do Ensino Fundamental');
  const [studyIntensity, setStudyIntensity] = useState(50);
  const [studyDepth, setStudyDepth] = useState('normal');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('escolaia_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isKeyValidating, setIsKeyValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [successMessageId, setSuccessMessageId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Simple test call
      await chatWithAI('Oi', [], undefined, false, schoolYear, undefined, customApiKey.trim());
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
      let textToCopy = message.content;
      
      const resultTags = [
        '[TEXTO HUMANIZADO]',
        '[RESULTADO DA PESQUISA]',
        '[AVALIAÇÃO FINAL]',
        '[ANÁLISE RÍGIDA]',
        '[CONTEÚDO DE ESTUDO]'
      ];
      
      const allTags = [...resultTags, '[DETECÇÃO]', '[TEXTO ORIGINAL]'];

      for (const tag of resultTags) {
        if (message.content.includes(tag)) {
          const parts = message.content.split(tag);
          if (parts.length > 1) {
            let content = parts[1].trim();
            // Remove any other tags that might follow
            for (const otherTag of allTags) {
              if (content.includes(otherTag)) {
                content = content.split(otherTag)[0].trim();
              }
            }
            textToCopy = content;
            break;
          }
        }
      }

      // Se houver fontes e for pesquisa, opcionalmente adicionar os links? 
      // O usuário disse "as fontes e o que pegou", então vamos adicionar os links no final se existirem
      if (message.sources && message.sources.length > 0) {
        const sourcesText = "\n\nFontes:\n" + message.sources.map(s => `- ${s.title}: ${s.uri}`).join('\n');
        textToCopy += sourcesText;
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSend = async (toolPrompt?: string) => {
    const textToSend = toolPrompt ? `${toolPrompt}\n\n${input}` : input;
    if ((!textToSend.trim() && !selectedImage) || isLoading) return;
    
    // Trigger green flash if a tool was used
    if (toolPrompt) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
    }

    // Close sidebar on mobile after selection
    setIsSidebarOpen(false);

    let finalPrompt = textToSend;
    if (textToSend.includes('[MAX_GRADE]')) {
      finalPrompt = textToSend.replace('[MAX_GRADE]', maxGrade);
    }
    if (textToSend.includes('[MAX_SOURCES]')) {
      finalPrompt = textToSend.replace('[MAX_SOURCES]', maxSources);
    }
    if (textToSend.includes('[STUDY_INTENSITY]')) {
      finalPrompt = textToSend.replace('[STUDY_INTENSITY]', studyIntensity.toString());
    }
    if (textToSend.includes('[STUDY_DEPTH]')) {
      finalPrompt = textToSend.replace('[STUDY_DEPTH]', studyDepth);
    }

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

      const useSearch = finalPrompt.includes('MODO PESQUISA ATIVADO');
      const isStudyMode = finalPrompt.includes('MODO ESTUDAR ATIVADO');
      
      const result = await chatWithAI(
        finalPrompt, 
        history, 
        currentImage || undefined, 
        useSearch, 
        schoolYear,
        isStudyMode ? { intensity: studyIntensity, depth: studyDepth } : undefined,
        customApiKey.trim()
      );
      
      let finalContent = result.text || 'Desculpe, tive um problema ao processar sua resposta.';
      
      // If it's a fallback (search failed), add a subtle notice
      if (result.isFallback) {
        finalContent = `⚠️ **Nota:** O limite de pesquisa em tempo real foi atingido. Esta resposta foi gerada com base no meu conhecimento interno atualizado.\n\n---\n\n${finalContent}`;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: finalContent,
        sources: result.sources
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Trigger success animation for image analysis
      if (currentImage) {
        setSuccessMessageId(userMessage.id);
        setTimeout(() => setSuccessMessageId(null), 3000);
      }
    } catch (error: any) {
      console.error('Error:', error);
      let errorMessage = error.message || 'Ocorreu um erro ao conectar com o assistente.';
      
      // If the error message is a JSON string (common with Gemini SDK), try to parse it
      try {
        if (errorMessage.startsWith('{')) {
          const parsedError = JSON.parse(errorMessage);
          if (parsedError.error?.message) {
            errorMessage = parsedError.error.message;
          }
        }
      } catch (e) {
        // Not JSON, keep original
      }
      
      // Check for specific API errors
      if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('Chave API não válida')) {
        errorMessage = 'Sua Chave de API parece ser inválida ou não foi configurada. Por favor, clique no botão "Configurar Chave API" na barra lateral para resolver.';
      } else if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429') || errorMessage.includes('quota')) {
        errorMessage = 'O limite de uso gratuito da IA foi atingido. Isso acontece porque muitas pessoas estão usando ao mesmo tempo ou você fez muitas pesquisas rápidas. Por favor, aguarde um minuto e tente novamente.';
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Ops! ${errorMessage} Verifique sua conexão ou tente novamente mais tarde.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenApiKeyDialog = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
      } else {
        alert('Esta função só está disponível no ambiente do AI Studio.');
      }
    } catch (err) {
      console.error('Failed to open API key dialog:', err);
    }
  };

  const clearChat = () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de conversas?')) {
      setMessages([]);
      setInput('');
      setSelectedImage(null);
      localStorage.removeItem('escolaia_chat_history');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('escolaia_authenticated');
    setIsAuthenticated(false);
    setAuthCode('');
    setIsSidebarOpen(false);
    window.location.reload(); // Force reload to ensure clean state
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const code = authCode.trim().toUpperCase();
    
    if (AUTHORIZED_CODES[code]) {
      // Check if this specific code has been used globally (simulated with localStorage for now)
      // Note: Real single-use across different browsers requires a backend database.
      const usedCodes = JSON.parse(localStorage.getItem('escolaia_used_codes') || '[]');
      
      if (usedCodes.includes(code)) {
        setAuthError('Este código já foi utilizado e é de uso único.');
        return;
      }

      // Mark as authenticated
      localStorage.setItem('escolaia_authenticated', 'true');
      
      // Mark this specific code as used in this browser
      usedCodes.push(code);
      localStorage.setItem('escolaia_used_codes', JSON.stringify(usedCodes));
      
      setIsAuthenticated(true);
    } else {
      setAuthError('Código de acesso inválido. Tente novamente.');
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="space-y-4">
            <h1 className="text-3xl font-display font-black tracking-tighter logo-gradient">EscolaIA</h1>
            <p className="text-slate-500 text-sm uppercase tracking-[0.3em] font-bold">Acesso Restrito</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="relative group">
              <input 
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Insira seu código de acesso"
                className={cn(
                  "w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-5 text-center text-xl text-white outline-none transition-all duration-500",
                  "focus:border-emerald-glow focus:shadow-[0_0_30px_rgba(16,185,129,0.1)]",
                  authError && "border-red-500/50 focus:border-red-500/50"
                )}
              />
              <div className="absolute inset-0 rounded-2xl border border-emerald-glow/0 group-hover:border-emerald-glow/20 pointer-events-none transition-all duration-500" />
            </div>

            <AnimatePresence mode="wait">
              {authError && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-red-400 text-xs font-bold uppercase tracking-widest"
                >
                  {authError}
                </motion.p>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              className="w-full bg-emerald-glow text-black font-black py-5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              ENTRAR NO SISTEMA
            </button>
          </form>

          <p className="text-[10px] text-slate-700 uppercase tracking-widest font-medium">
            Ambiente Seguro • Criptografia de Ponta
          </p>
        </motion.div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-4">
      <div className="flex items-center justify-between mb-12">
        <a href="/" className="flex items-center gap-3 group transition-all duration-300">
          <span className="text-2xl font-display font-black tracking-tighter logo-gradient">EscolaIA</span>
        </a>
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden p-2 text-slate-500 hover:text-emerald-glow transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-10 flex-1 overflow-y-auto pr-2 no-scrollbar">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Configurações</h2>
          <div className="space-y-6 px-1">
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Ano Escolar</label>
              <select 
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-emerald-glow/50 appearance-none cursor-pointer backdrop-blur-md transition-all duration-300"
              >
                <option value="6º ano do Ensino Fundamental" className="bg-bg-deep">6º ano (Fundamental)</option>
                <option value="7º ano do Ensino Fundamental" className="bg-bg-deep">7º ano (Fundamental)</option>
                <option value="8º ano do Ensino Fundamental" className="bg-bg-deep">8º ano (Fundamental)</option>
                <option value="9º ano do Ensino Fundamental" className="bg-bg-deep">9º ano (Fundamental)</option>
                <option value="1º ano do Ensino Médio" className="bg-bg-deep">1º ano (Médio)</option>
                <option value="2º ano do Ensino Médio" className="bg-bg-deep">2º ano (Médio)</option>
                <option value="3º ano do Ensino Médio" className="bg-bg-deep">3º ano (Médio)</option>
                <option value="Ensino Superior / Faculdade" className="bg-bg-deep">Ensino Superior</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Nota Máx.</label>
                <input 
                  type="number" 
                  value={maxGrade}
                  onChange={(e) => setMaxGrade(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-emerald-glow/50 backdrop-blur-md transition-all duration-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Fontes</label>
                <input 
                  type="number" 
                  value={maxSources}
                  onChange={(e) => setMaxSources(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-emerald-glow/50 backdrop-blur-md transition-all duration-300"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Intensidade</label>
                  <span className="text-[10px] font-bold text-emerald-glow">{studyIntensity}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={studyIntensity}
                  onChange={(e) => setStudyIntensity(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-glow"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Profundidade</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'explicar muito', label: 'Avançado' },
                    { id: 'explicar muito muito', label: 'Especialista' }
                  ].map((depth) => (
                    <button
                      key={depth.id}
                      onClick={() => setStudyDepth(depth.id)}
                      className={cn(
                        "text-left px-4 py-3 rounded-xl text-xs transition-all duration-300 border",
                        studyDepth === depth.id 
                          ? "bg-emerald-glow/10 border-emerald-glow text-emerald-glow font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                          : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                      )}
                    >
                      {depth.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Ferramentas</h2>
          <div className="space-y-4">
            {SPECIAL_TOOLS.map((tool) => (
              <button
                key={tool.label}
                onClick={() => handleSend(tool.prompt)}
                className="w-full flex items-center gap-4 text-slate-500 hover:text-white transition-all text-left group"
              >
                <div className={cn("p-2 rounded-lg transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]", tool.color.replace('from-', 'bg-').split(' ')[0])}>
                  <tool.icon size={16} />
                </div>
                <span className="text-sm font-medium">{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Matérias</h2>
          <div className="grid grid-cols-1 gap-4">
            {SUBJECTS.slice(0, 4).map((subject) => (
              <button
                key={subject.name}
                onClick={() => handleSend(subject.prompt)}
                className="flex items-center gap-4 text-slate-500 hover:text-white transition-all text-left group"
              >
                <div className={cn("p-2 rounded-lg transition-all group-hover:scale-110 border", subject.color)}>
                  <subject.icon size={16} />
                </div>
                <span className="text-sm font-medium">{subject.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 space-y-4">
          <div className="space-y-2">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="w-full flex items-center justify-between text-slate-500 hover:text-white transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-2 rounded-lg transition-all",
                  customApiKey.trim() ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5"
                )}>
                  <Key size={16} />
                </div>
                <span className="text-sm font-medium">
                  {customApiKey.trim() ? "Chave Ativa" : "Chave API"}
                </span>
              </div>
              {customApiKey.trim() && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
              )}
            </button>
            
            <AnimatePresence>
              {showApiKeyInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-white/5 rounded-2xl space-y-3 mt-2 border border-white/10 backdrop-blur-md">
                    <input 
                      type="text"
                      value={customApiKey}
                      onChange={(e) => { setCustomApiKey(e.target.value); setKeyStatus('idle'); }}
                      placeholder="AIzaSy..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-glow outline-none font-mono transition-all duration-300"
                    />
                    <button 
                      onClick={validateApiKey}
                      disabled={isKeyValidating || !customApiKey.trim()}
                      className={cn(
                        "w-full py-2.5 text-[10px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                        keyStatus === 'success' ? "bg-emerald-500 text-white" :
                        keyStatus === 'error' ? "bg-red-500 text-white" :
                        "bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                      )}
                    >
                      {isKeyValidating ? <Loader2 size={12} className="animate-spin" /> : "Validar"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={clearChat}
            className="w-full flex items-center gap-4 text-red-400/60 hover:text-red-400 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-red-500/5 group-hover:bg-red-500/10 transition-all">
              <X size={16} />
            </div>
            <span className="text-sm font-medium">Limpar Histórico</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 text-slate-500 hover:text-white transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all">
              <LogOut size={16} />
            </div>
            <span className="text-sm font-medium">Sair da Conta</span>
          </button>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <p className="text-[10px] text-slate-300 font-medium tracking-wide">
          VERSÃO PRO 2.0
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "flex h-screen bg-bg-deep overflow-hidden font-sans mesh-gradient transition-colors duration-500",
      isFlashing && "selection-flash"
    )}>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 glass-panel p-8 m-4 rounded-3xl shadow-2xl shadow-black/50">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-[320px] glass-panel z-50 p-6 flex flex-col md:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full max-w-6xl mx-auto">
        {/* Header - Mobile */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-3 -ml-3 text-slate-400 hover:text-emerald-glow transition-colors active:scale-95"
          >
            <Menu size={24} />
          </button>
          <a href="/" className="flex items-center gap-2 group transition-all duration-300">
            <span className="text-lg font-display font-black tracking-tighter logo-gradient">EscolaIA</span>
          </a>
          <button 
            onClick={clearChat}
            className="p-3 -mr-3 text-slate-500 hover:text-red-400 transition-colors active:scale-95"
          >
            <X size={24} />
          </button>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-12 py-8 md:py-12 space-y-10 md:space-y-12 no-scrollbar"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-16 md:space-y-24 py-10 md:py-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="space-y-6 px-4"
              >
                <h2 className="text-4xl md:text-7xl font-display font-extrabold text-white leading-tight tracking-tighter">
                  <Typewriter text="EscolaIA" delay={150} />
                </h2>
                <p className="text-slate-400 text-base md:text-xl max-w-lg mx-auto font-light leading-relaxed">
                  A inteligência artificial <span className="text-emerald-glow font-medium">premium</span> para o futuro da sua educação.
                </p>
              </motion.div>

              {/* Xbox Style Dashboard */}
              <div className="w-full max-w-6xl px-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-12 text-center opacity-60">Diretório de Ferramentas</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {SPECIAL_TOOLS.map((tool, i) => (
                    <motion.button
                      key={tool.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      onClick={() => handleSend(tool.prompt)}
                      className="xbox-card group flex flex-col items-center text-center p-8"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500",
                        "bg-white/5 group-hover:bg-emerald-glow/10 group-hover:scale-110"
                      )}>
                        <tool.icon size={28} className="text-white group-hover:text-emerald-glow transition-colors" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2 tracking-tight">{tool.label}</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium opacity-0 group-hover:opacity-100 transition-all duration-300">
                        {tool.description}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 max-w-xl">
                {QUICK_ACTIONS.map((action, i) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + i * 0.1 }}
                    onClick={() => handleSend(action.prompt)}
                    className="px-6 py-3 rounded-xl glass-panel text-slate-400 text-xs hover:text-white hover:border-white/20 transition-all active:scale-95"
                  >
                    {action.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[90%] md:max-w-[80%] space-y-4",
                  message.role === 'user' ? "text-right" : "text-left"
                )}>
                  {message.image && (
                    <div className="inline-block overflow-hidden rounded-3xl border border-white/10 relative shadow-2xl group">
                      <img 
                        src={message.image} 
                        alt="Upload" 
                        className={cn(
                          "max-h-80 w-auto object-contain transition-all duration-700",
                          isLoading && messages[messages.length - 1].id === message.id && "brightness-50 grayscale-[0.5] sepia-[0.2] hue-rotate-[90deg]"
                        )}
                        referrerPolicy="no-referrer"
                      />
                      {isLoading && messages[messages.length - 1].id === message.id ? (
                        <>
                          <div className="scan-line" />
                          <div className="scan-overlay" />
                        </>
                      ) : (
                        successMessageId === message.id && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-emerald-glow rounded-full p-4 shadow-[0_0_30px_rgba(16,185,129,0.6)] success-pop">
                              <Check size={32} className="text-black stroke-[3]" />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  <div className={cn(
                    "glass-panel p-6 md:p-8 rounded-[2rem] shadow-2xl transition-all duration-500",
                    message.role === 'user' 
                      ? "bg-emerald-glow/5 border-emerald-glow/20 text-white font-medium" 
                      : "bg-white/[0.02] border-white/5 text-slate-300 font-light",
                    isLoading && messages[messages.length - 1].id === message.id && "processing-pulse"
                  )}>
                    <div className="markdown-body">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {isLoading && messages[messages.length - 1].id === message.id && message.role === 'model' && (
                      <div className="mt-4 flex items-center gap-1 dot-loader">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-glow" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-glow" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-glow" />
                      </div>
                    )}
                  </div>

                  {message.role === 'model' && (
                    <div className="flex justify-start mt-4 gap-3">
                      <button
                        onClick={() => copyToClipboard(message)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest group"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} className="group-hover:scale-110 transition-transform" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Fontes de Pesquisa</p>
                      <div className="flex flex-wrap gap-3">
                        {message.sources.map((source, idx) => (
                          <a 
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 text-xs hover:bg-emerald-glow hover:text-black hover:font-bold transition-all duration-300 group"
                          >
                            <span className="max-w-[180px] truncate">{source.title || 'Ver Fonte'}</span>
                            <ExternalLink size={12} className="opacity-40 group-hover:opacity-100" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-4 text-emerald-glow/60">
                <div className="relative">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <div className="absolute inset-0 blur-sm bg-emerald-glow/40 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Processando</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 md:p-12">
          <div className="max-w-4xl mx-auto relative">
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-24 left-0 mb-4 relative inline-block group"
              >
                <img 
                  src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                  alt="Preview" 
                  className="h-20 w-20 object-cover rounded-2xl border-2 border-emerald-glow shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )}
            
            <div className="glass-panel p-2 rounded-[2.5rem] shadow-2xl focus-within:border-emerald-glow/50 transition-all duration-500 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-4 text-slate-500 hover:text-emerald-glow transition-colors duration-300 shrink-0 active:scale-90"
              >
                <ImageIcon size={24} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageSelect} 
                className="hidden" 
                accept="image/*"
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="O que vamos aprender hoje?"
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-4 text-base md:text-xl text-white placeholder:text-slate-600 min-w-0"
              />
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className={cn(
                  "p-4 rounded-full transition-all duration-300 shrink-0 active:scale-90",
                  input.trim() || selectedImage 
                    ? "bg-emerald-glow text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                    : "text-slate-700"
                )}
              >
                <Send size={24} />
              </button>
            </div>
            <p className="text-center mt-6 text-[10px] text-slate-600 font-medium tracking-widest uppercase">
              EscolaIA v2.0 • Powered by Gemini Next-Gen
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
