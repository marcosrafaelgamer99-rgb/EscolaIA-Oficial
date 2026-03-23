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
  modelType: 'normal' | 'pro' = 'pro'
) {
  const apiKey = 
    customApiKey ||
    (typeof process !== 'undefined' && process.env ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : null) || 
    (import.meta.env ? (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY) : null) || 
    "";

  if (!apiKey) {
    throw new Error("A chave da API do Gemini não foi encontrada. Por favor, verifique as configurações do ambiente.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const parts: any[] = [{ text: message }];
  if (image) {
    parts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  let studyInstruction = "";
  if (studyConfig) {
    studyInstruction = `\n\nMODO ESTUDAR ATIVADO:
    - INTENSIDADE (Quanto quer estudar): ${studyConfig.intensity}/100.
    - PROFUNDIDADE (Como explicar): ${studyConfig.depth}.
    Ajuste a resposta para este nível de detalhamento.`;
  }

  const baseInstruction = modelType === 'pro' ? PRO_INSTRUCTION : BASE_INSTRUCTION;
  const dynamicInstruction = `${baseInstruction}\n\nO USUÁRIO ESTÁ NO SEGUINTE ANO ESCOLAR: ${schoolYear}. Ajuste o nível de complexidade, rigor da nota e linguagem para este nível específico.${studyInstruction}`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: "user", parts }
      ],
      config: {
        systemInstruction: dynamicInstruction,
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
      },
    });

    if (!result.text) {
      throw new Error("O assistente não retornou nenhuma resposta de texto.");
    }

    return {
      text: result.text,
      isFallback: false,
      sources: result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title,
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || []
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Fallback logic: If search fails due to quota (429), try again without search
    if (useSearch && (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota'))) {
      console.log("Search quota exceeded, falling back to standard model knowledge...");
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            ...history,
            { role: "user", parts }
          ],
          config: {
            systemInstruction: dynamicInstruction + "\n\nAVISO: O limite de pesquisa em tempo real foi atingido. Responda usando apenas seu conhecimento interno, mas mencione que não foi possível acessar a internet agora.",
          },
        });

        if (fallbackResponse.text) {
          return {
            text: fallbackResponse.text,
            isFallback: true,
            sources: []
          };
        }
      } catch (fallbackError) {
        console.error("Fallback failed:", fallbackError);
      }
    }
    
    throw error;
  }
}
