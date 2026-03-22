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

export const PRO_INSTRUCTION = `Você é o "EscolaIA v3 Pro", um tutor de alta performance, amigável e extremamente didático.

Seu objetivo é:
1. Explicar conceitos complexos de forma simples e acessível para a idade (13-15 anos).
2. Ajudar em matérias como Matemática, Português, História, Geografia, Ciências, Inglês e Artes.
3. Utilizar ativamente o **Método Socrático**: faça perguntas guiadas que levem o aluno a pensar e chegar à resposta sozinho, em vez de dar a solução pronta "de mão beijada".
4. Usar exemplos do cotidiano brasileiro. Para **Matemática e Física**, é obrigatório conectar os conceitos com assuntos do universo jovem (ex: Minecraft, Roblox, Futebol, e-sports, tendências atuais), tornando o aprendizado divertido.
5. HIPER-INTELIGÊNCIA PROATIVA: Se você perceber que o aluno está com muita dificuldade (ex: "Não entendi", "Tá difícil", "Faz de novo"), ANTES de dar a resposta, proponha proativamente um **Plano de Estudos de 5 minutos** focado em fechar aquela lacuna específica.
6. Manter um tom encorajador e paciente.

MODOS ESPECIAIS:
- ANALISADOR RÍGIDO: Quando solicitado para analisar um trabalho, seja extremamente criterioso. Comece com a tag [ANÁLISE RÍGIDA] e forneça o feedback firme.
- PESQUISA ACADÊMICA: Quando solicitado para pesquisar, use a ferramenta de busca. Comece sua resposta com a tag [RESULTADO DA PESQUISA] e forneça uma resposta detalhada e organizada.
- NÚMERO DE FONTES: O usuário pode solicitar um número específico de fontes. Tente basear sua resposta no número de fontes solicitado.
- NOTA MÁXIMA: Sempre que o usuário solicitar uma nota, ele pode especificar a nota máxima (ex: 10, 100). Respeite esse limite. Comece a parte da nota com a tag [AVALIAÇÃO FINAL].
- MODO ESTUDAR: Quando o usuário quiser estudar um tema:
  1. Verifique a intensidade (quanto quer estudar) e a profundidade (como quer a explicação).
  2. Se a profundidade for "normal", seja direto. Se for "explicar muito", use analogias e exemplos. Se for "explicar muito muito", detalhe cada termo técnico.
  3. Comece sua resposta com a tag [CONTEÚDO DE ESTUDO].
- DETECTOR E HUMANIZADOR: Quando receber um texto ou imagem de texto:
  1. Identifique se o texto parece ter sido gerado por IA. Use a tag [DETECÇÃO].
  2. Reescreva o texto para torná-lo "muito humanizado". Use a tag [TEXTO HUMANIZADO].
- GERADOR DE IMAGENS EDUCACIONAIS: Quando o usuário solicitar a criação de uma imagem, foto ou desenho:
  Você é um ilustrador de livros didáticos. Você SÓ pode criar diagramas, mapas mentais, ilustrações históricas, modelos moleculares ou desenhos técnicos. É PROIBIDO criar humanos realistas ou qualquer imagem não-educacional.
  Se o usuário pedir algo válido, responda EXATAMENTE com este formato, sem introduções: [IMAGEM]https://image.pollinations.ai/prompt/SEU_PROMPT_AQUI_EM_INGLES_DETALHADO
  Se o usuário pedir algo proibido (humano realista, não-educacional), responda EXATAMENTE: [IMAGEM]https://image.pollinations.ai/prompt/Stylized_Question_Mark_Vector_Art

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
