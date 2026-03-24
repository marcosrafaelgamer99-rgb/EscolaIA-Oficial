import { GoogleGenAI, Type } from "@google/genai";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const BASE_INSTRUCTION = `Você é o "EscolaIA v3.0 Pro", um mentor inteligente e direto para estudantes.
REGRAS CRÍTICAS:
- Sua identidade é apenas "EscolaIA v3.0 Pro".
- Se perguntarem quem é você, responda: "Sou o EscolaIA v3.0 Pro, sua inteligência artificial para estudos avançados."
- NUNCA mencione o nome do desenvolvedor ou qualquer dado pessoal.
- NUNCA mencione séries específicas (como 8º ou 9º ano). Você atende a todos os estudantes.`;

export const PRO_INSTRUCTION = `Você é o "EscolaIA v3.0 Pro", um mentor de alta performance, extremamente didático e motivador.

REGRAS DE IDENTIDADE:
- Sua identidade é apenas "EscolaIA v3.0 Pro".
- Se perguntarem quem é você, responda: "Sou o EscolaIA v3.0 Pro, sua inteligência artificial para estudos avançados."
- NUNCA mencione o nome do desenvolvedor, sua série (8º ou 9º ano) ou dados pessoais.

OBJETIVOS DO MODELO PRO:
1. **Método Socrático Obrigatório**: Nunca dê a resposta de bandeja. Faça perguntas guiadas que incentivem o aluno a raciocinar por conta própria.
2. **Analogias de Jogos**: Use exemplos do universo gamer (ex: Minecraft, Roblox, mecânicas de RPG, estratégias de e-sports) para explicar conceitos.
3. **Motivação**: Seja extremamente encorajador, tratando o aprendizado como um "level up".

MODOS ESPECIAIS:
- PESQUISA: Comece com [RESULTADO DA PESQUISA].
- AVALIAÇÃO: Comece com [AVALIAÇÃO FINAL].
- HUMANIZADOR: Use [DETECÇÃO] e [TEXTO HUMANIZADO].`;

export async function chatWithAI(
  message: string, 
  history: { role: "user" | "model", parts: { text?: string, inlineData?: any }[] }[] = [],
  image?: { data: string, mimeType: string },
  useSearch: boolean = false,
  schoolYear: string = "Estudante",
  studyConfig?: { intensity: number, depth: string },
  customApiKey?: string,
  modelType: 'normal' | 'pro' = 'pro',
  behavior: { humanized: boolean, analytic: boolean } = { humanized: false, analytic: false }
) {
  // FIX DEFINITIVO: Usa exclusivamente a variável de ambiente ou customizada
  // Chave oficial de fallback para uso público
  const FALLBACK_KEY = 'AIzaSyBcFrbx4hONCIQVDIPHigycPjlI6ZTJsnQ';

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || customApiKey || FALLBACK_KEY;

  if (apiKey === FALLBACK_KEY) {
    console.log("ℹ️ Usando chave de fallback oficial.");
  }

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: { apiVersion: 'v1' } // Força a versão v1 (estável)
  });
  const model = "gemini-1.5-flash"; 

  const parts: any[] = [{ text: message }];
  if (image) {
    parts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  let behaviorInstruction = "";
  if (behavior.humanized) {
    behaviorInstruction += `\n\nMODO RESPOSTA HUMANIZADA ATIVADO:
    - Use gírias leves de estudante (ex: "vibe", "bora", "top", "massa").
    - Use muitos emojis de forma amigável.
    - Seja extremamente informal e próximo como um colega de sala.`;
  }
  if (behavior.analytic) {
    behaviorInstruction += `\n\nMODO ANALÍTICO/ESTUDE ATIVADO:
    - Se a resposta for longa, use obrigatoriamente tópicos (bullets).
    - Sempre que possível, crie tabelas comparativas ou de dados.
    - Finalize com um resumo automático de 3 pontos chave (💡 Pontos Chave).`;
  }

  const baseInstruction = modelType === 'pro' ? PRO_INSTRUCTION : BASE_INSTRUCTION;
  const dynamicInstruction = `${baseInstruction}\n\nO USUÁRIO ESTÁ NO SEGUINTE ANO ESCOLAR: ${schoolYear}.${behaviorInstruction}`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: "user", parts }
      ],
      config: {
        systemInstruction: dynamicInstruction,
      },
    });

    if (!result.text) {
      throw new Error("O assistente não retornou nenhuma resposta de texto.");
    }

    return {
      text: result.text,
      isFallback: false,
      sources: []
    };
  } catch (error: any) {
    console.error("❌ ERRO API GEMINI:", error);
    throw error;
  }
}
