import { GoogleGenerativeAI, type GenerateContentResult } from "@google/generative-ai";

type GeminiGenerateOptions = {
  modelName: string;
  systemInstruction: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  topP?: number;
};

let client: GoogleGenerativeAI | null = null;

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for Gemini analysis");
  client ??= new GoogleGenerativeAI(apiKey);
  return client;
}

export async function generateGeminiText({
  modelName,
  systemInstruction,
  prompt,
  maxOutputTokens,
  temperature,
  topP,
}: GeminiGenerateOptions): Promise<{ text: string; result: GenerateContentResult }> {
  const model = getClient().getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      maxOutputTokens,
      temperature,
      ...(topP === undefined ? {} : { topP }),
    },
  });

  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    result,
  };
}

export function readGeminiUsage(result: GenerateContentResult) {
  return result.response.usageMetadata ?? null;
}
