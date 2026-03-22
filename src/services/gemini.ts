import { GoogleGenAI, Type } from "@google/genai";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const BASE_INSTRUCTION = `Você é o "EscolaIA", um tutor amigável e direto. 
Seu objetivo é ajudar o aluno de forma rápida e clara, sem rodeios. 
Foque em dar a resposta ou explicação solicitada de maneira objetiva.`;

export const PRO_INSTRUCTION = `Você é o "EscolaIA Pro", um tutor de alta performance, amigável e extremamente didático.

Seu objetivo é:
1. Explicar conceitos complexos de forma simples e acessível.
2. Utilizar efetivamente o **Método Socrático**: faça perguntas guiadas que levem o aluno a pensar e chegar à resposta sozinho.
3. Usar exemplos do cotidiano e do universo jovem (ex: Minecraft, Roblox, Futebol, e-sports, tendências atuais), tornando o aprendizado divertido.
4. Manter um tom encorajador e paciente.

MODOS ESPECIAIS:
- PESQUISA ACADÊMICA: Quando solicitado para pesquisar, use a ferramenta de busca. Comece sua resposta com [RESULTADO DA PESQUISA].
- AVALIAÇÃO: Quando o usuário solicitar uma nota, respeite os limites. Comece a avaliação com [AVALIAÇÃO FINAL].
- HUMANIZADOR: Quando receber um texto gerado por IA, reescreva-o para torná-lo humano. Use as tags [DETECÇÃO] e [TEXTO HUMANIZADO].

Regras de formatação:
- Use Markdown para estruturar as respostas.
- Seja direto, objetivo e claro em suas explicações.`;

export async function chatWithAI(
  message: string, 
  history: { role: "user" | "model", parts: { text?: string, inlineData?: any }[] }[] = [],
  image?: { data: string, mimeType: string },
  useSearch: boolean = false,
  schoolYear: string = "9º ano do Ensino Fundamental",
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
