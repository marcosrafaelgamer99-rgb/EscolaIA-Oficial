import { HfInference } from "@huggingface/inference";

// Inicializa o cliente do Hugging Face exatamente como solicitado
const hf = new HfInference(import.meta.env.VITE_HF_TOKEN);

// Modelo definido pelo usuário para a v3.0
const MODEL_NAME = "meta-llama/Llama-3.2-1B-Instruct";

export type AgentState = 
  | 'idle' 
  | 'local'
  | 'supervisor'
  | 'pesquisador' 
  | 'escritor' 
  | 'analista' 
  | 'humanizador';

export const AgentStateMessages: Record<AgentState, string> = {
  idle: '',
  local: '⚡ Respondendo rápido (Modo Local)...',
  supervisor: '🧠 Supervisor mapeando a dúvida...',
  pesquisador: '🔍 Pesquisando no Google e YouTube...',
  escritor: '✍️ Escrevendo a explicação didática...',
  analista: '🧠 Analisando informações e checando fatos...',
  humanizador: '🔥 Deixando a resposta estilosa...'
};

/**
 * Função principal que orquestra o Cérebro Multi-Agente
 * @param query Pergunta principal do aluno
 * @param onStateChange Callback para a UI interativa
 */
export async function processarDuvidaEscolar(
  query: string, 
  onStateChange: (state: AgentState) => void,
  modoPesquisaAtivado: boolean = false
): Promise<string> {
  try {
    let researchData = "";
    
    if (modoPesquisaAtivado) {
      // 0. SUPERVISOR (Decisão de Rota)
      onStateChange('supervisor');
      const needsResearch = await runSupervisor(query);

      if (needsResearch) {
        // 1. PESQUISADOR (Busca Fatos/YouTube)
        onStateChange('pesquisador');
        researchData = await runPesquisador(query);
      }
    } else {
      // MODO LOCAL (Sem requisições externas)
      onStateChange('local');
      // Pequeno timeout visual apenas para a UI não piscar rápido demais
      await new Promise(r => setTimeout(r, 600));
    }

    // 2. ESCRITOR (Base Didática)
    onStateChange('escritor');
    const writerText = await runEscritor(query, researchData);

    // 3. ANALISTA (Verificador de Fatos - Nível 8º Ano)
    onStateChange('analista');
    const analysedText = await runAnalista(writerText);

    // 4. HUMANIZADOR (Estilo Bro)
    onStateChange('humanizador');
    const finalAnswer = await runHumanizador(analysedText);

    onStateChange('idle');
    return finalAnswer;

  } catch (error: any) {
    onStateChange('idle');
    console.error("Erro no fluxo Llama-3.2-1B Multi-Agente:", error);
    throw new Error(`Falha na rede Neural: ${error.message || 'Erro Desconhecido'}`);
  }
}

// ==========================================
// FUNÇÕES DOS AGENTES (Integrações com HF)
// ==========================================

async function callLlama(sysPrompt: string, userMessage: string): Promise<string> {
  const messages = [
    { role: "system", content: sysPrompt },
    { role: "user", content: userMessage }
  ];

  try {
    const response = await hf.chatCompletion({
      model: MODEL_NAME,
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    });
    
    return response.choices[0].message.content || "";
  } catch (error: any) {
    // Log exato do erro para a aba F12 do navegador
    console.error("=== ERRO REAL DO HUGGING FACE ===");
    console.error("Nome do Erro:", error.name);
    console.error("Mensagem:", error.message);
    console.error("Stack Trace:", error.stack);
    console.error("=================================");
    
    // Se for 'Failed to fetch', normalmente é bloqueio de CORS ou chave inválida
    if (error.message === "Failed to fetch") {
      console.warn("Dica: 'Failed to fetch' no navegador costuma ser CORS bloqueando a requisição direta ou o modelo demorando muito para responder (Cold Start).");
    }
    
    throw error;
  }
}

async function buscarContexto(query: string): Promise<string> {
  const tavilyKey = import.meta.env.VITE_TAVILY_KEY;
  if (!tavilyKey) {
    console.warn("[Tavily] Sem chave API. Simulando busca...");
    return `Simulação de busca na web para: ${query}. (Cadastre VITE_TAVILY_KEY no .env para buscas reais).`;
  }

  console.log(`[Pesquisador] Buscando contexto na Web via Tavily: ${query}`);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: "basic",
        include_answers: true,
        max_results: 3,
      }),
    });
    const data = await res.json();
    if (data.results) {
      return data.results.map((r: any) => `Fonte: ${r.url}\nResumo: ${r.content}`).join("\n\n");
    }
  } catch (error) {
    console.error("Erro na busca web:", error);
  }
  return "Busca na web falhou.";
}

async function buscarYouTube(url: string): Promise<string> {
  console.log(`[YouTube] Lendo legendas do vídeo: ${url}`);
  try {
    const res = await fetch(`/api/tools/youtube?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Falha ao obter legendas");
    const data = await res.json();
    return `[Transcrição do Vídeo]: ${data.text}`;
  } catch (error) {
    console.error("Erro na leitura do YouTube:", error);
    return "Não foi possível carregar as legendas do vídeo.";
  }
}

async function runSupervisor(query: string): Promise<boolean> {
  const sysPrompt = "Você coordena a equipe EscolaIA. Analise a pergunta do Marcos. Se precisar de fatos novos ou YouTube, chame o Pesquisador. Se for dúvida simples, mande direto para o Escritor. Você decide quem trabalha. Responda apenas com a palavra PESQUISADOR ou ESCRITOR.";
  const res = await callLlama(sysPrompt, `Pergunta do Marcos: "${query}"\nQual agente deve atuar primeiro?`);
  console.log("[Supervisor] Decisão:", res);
  return res.toUpperCase().includes("PESQUISADOR");
}

async function runPesquisador(query: string): Promise<string> {
  const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
  const match = query.match(ytRegex);

  let fetchedData = "";
  if (match) {
    fetchedData = await buscarYouTube(match[0]);
  } else {
    fetchedData = await buscarContexto(query);
  }

  const sysPrompt = "Sua função é usar a internet e as legendas do YouTube. Traga apenas os fatos reais, links e o que foi dito nos vídeos. Não dê opinião, apenas dados.";
  const msg = `Dados brutos coletados:\n${fetchedData}\n\nSintetize os fatos encontrados para a equipe:`;
  return await callLlama(sysPrompt, msg);
}

async function runEscritor(query: string, researchData: string): Promise<string> {
  const sysPrompt = "Você é um professor brilhante. Crie a explicação didática baseada no que o Pesquisador achou (se houver) ou no seu próprio conhecimento.";
  const msg = `Pergunta: "${query}"\nFatos Pesquisados: "${researchData || 'Nenhum fato extra. Use seu conhecimento.'}"\nEscreva a explicação:`;
  return await callLlama(sysPrompt, msg);
}

async function runAnalista(textToAnalyse: string): Promise<string> {
  const sysPrompt = "Verifique se a resposta do Pesquisador ou do Escritor faz sentido para um aluno do 8º ano. Corrija erros de lógica e garanta que não seja fake news.";
  const msg = `Texto para análise e correção:\n${textToAnalyse}\n\nReescreva a versão validada e precisa:`;
  return await callLlama(sysPrompt, msg);
}

async function runHumanizador(analysedText: string): Promise<string> {
  const sysPrompt = "Pegue a resposta final e transforme em linguagem de mano. Use gírias de estudante, emojis e explique de um jeito que um parça entenderia.";
  const msg = `Texto aprovado pelo Analista:\n${analysedText}\n\nHumanize o texto agora no estilo solicitado:`;
  return await callLlama(sysPrompt, msg);
}
