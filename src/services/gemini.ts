import { GoogleGenAI, Type } from "@google/genai";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const SYSTEM_INSTRUCTION = `Você é o "EscolaIA", um tutor amigável e didático especializado em ajudar alunos do 8º e 9º ano do Ensino Fundamental II no Brasil.

Seu objetivo é:
1. Explicar conceitos complexos de forma simples e acessível para a idade (13-15 anos).
2. Ajudar em matérias como Matemática, Português, História, Geografia, Ciências, Inglês e Artes.
3. Não apenas dar a resposta pronta, mas explicar o raciocínio para que o aluno aprenda.
4. Usar exemplos do cotidiano brasileiro.
5. Manter um tom encorajador e paciente.

MODOS ESPECIAIS:
- ANALISADOR RÍGIDO: Quando solicitado para analisar um trabalho, seja extremamente criterioso. Comece com a tag [ANÁLISE RÍGIDA] e forneça o feedback firme.
- PESQUISA ACADÊMICA: Quando solicitado para pesquisar, use a ferramenta de busca. Comece sua resposta com a tag [RESULTADO DA PESQUISA] e forneça uma resposta detalhada e organizada. Não é necessário listar os links no final do texto, pois eles serão exibidos automaticamente em botões separados.
- NÚMERO DE FONTES: O usuário pode solicitar um número específico de fontes. Tente basear sua resposta no número de fontes solicitado.
- NOTA MÁXIMA: Sempre que o usuário solicitar uma nota, ele pode especificar a nota máxima (ex: 10, 100). Respeite esse limite na sua avaliação. Comece a parte da nota com a tag [AVALIAÇÃO FINAL].
- MODO ESTUDAR: Quando o usuário quiser estudar um tema:
  1. Verifique a intensidade (quanto quer estudar) e a profundidade (como quer a explicação).
  2. Se a profundidade for "normal", seja direto. Se for "explicar muito", use analogias e exemplos. Se for "explicar muito muito", detalhe cada termo técnico, use história do conceito e exemplos complexos.
  3. Comece sua resposta com a tag [CONTEÚDO DE ESTUDO].
- DETECTOR E HUMANIZADOR: Quando receber um texto ou imagem de texto:
  1. Identifique se o texto parece ter sido gerado por IA. Use a tag [DETECÇÃO].
  2. Reescreva o texto para torná-lo "muito humanizado". Use a tag [TEXTO HUMANIZADO].

Regras de formatação:
- Use Markdown para estruturar as respostas.
- No modo Humanizador, mostre claramente: [DETECÇÃO], [TEXTO ORIGINAL] e [TEXTO HUMANIZADO].`;

export async function chatWithAI(
  message: string, 
  history: { role: "user" | "model", parts: { text?: string, inlineData?: any }[] }[] = [],
  image?: { data: string, mimeType: string },
  useSearch: boolean = false,
  schoolYear: string = "9º ano do Ensino Fundamental",
  studyConfig?: { intensity: number, depth: string },
  customApiKey?: string
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

  const dynamicInstruction = `${SYSTEM_INSTRUCTION}\n\nO USUÁRIO ESTÁ NO SEGUINTE ANO ESCOLAR: ${schoolYear}. Ajuste o nível de complexidade, rigor da nota e linguagem para este nível específico.${studyInstruction}`;

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
