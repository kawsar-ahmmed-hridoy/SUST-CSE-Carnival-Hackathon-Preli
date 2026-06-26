/**
 * Google Gemini 2.5 Flash provider.
 * Used as the primary AI provider when AI_PROVIDER=primary and GEMINI_API_KEY is set.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '@/config';
import logger from '@/utils/logger';
import { ExternalServiceError, TimeoutError } from '@/utils/errors';
import { IAIService, IInvestigationInput, IInvestigationOutput } from '@/ai/aiService';
import { buildInvestigationPrompt } from '@/ai/prompts/investigatorPrompt';

function safeParseJson(text: string): IInvestigationOutput | null {
  // Strip leading/trailing markdown fences if the model added them.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    return obj as unknown as IInvestigationOutput;
  } catch {
    // Attempt to find a JSON substring inside the text.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const obj = JSON.parse(match[0]) as Record<string, unknown>;
      return obj as unknown as IInvestigationOutput;
    } catch {
      return null;
    }
  }
}

class GeminiProvider implements IAIService {
  public readonly providerName = 'gemini';

  private client: GoogleGenerativeAI;
  private modelName: string;
  private timeoutMs: number;

  constructor(apiKey: string, modelName: string, timeoutMs: number) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
  }

  async generateInvestigation(input: IInvestigationInput): Promise<IInvestigationOutput> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: config.ai.temperature,
        maxOutputTokens: config.ai.maxOutputTokens,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildInvestigationPrompt(input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await model.generateContent(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { signal: controller.signal } as unknown as RequestOptions,
      );
      clearTimeout(timer);
      const text = result.response.text();
      const parsed = safeParseJson(text);
      if (!parsed) {
        logger.warn({ provider: this.providerName }, 'Gemini returned non-JSON output');
        throw new ExternalServiceError('AI provider returned malformed output');
      }
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : 'unknown error';
      if (controller.signal.aborted) {
        throw new TimeoutError(`Gemini request timed out after ${this.timeoutMs}ms`);
      }
      logger.error({ err: message, provider: this.providerName }, 'Gemini call failed');
      throw new ExternalServiceError(`Gemini call failed: ${message}`);
    }
  }
}

interface RequestOptions {
  signal: AbortSignal;
}

export function createGeminiProvider(): IAIService | null {
  if (!config.ai.gemini.apiKey) return null;
  return new GeminiProvider(
    config.ai.gemini.apiKey,
    config.ai.gemini.model,
    config.ai.timeoutMs,
  );
}