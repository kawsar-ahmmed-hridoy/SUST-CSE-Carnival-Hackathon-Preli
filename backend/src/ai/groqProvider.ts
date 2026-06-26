/**
 * Groq (Llama 3.x) provider.
 * Used as the fallback when Gemini fails or AI_PROVIDER=groq.
 */

import Groq from 'groq-sdk';
import config from '@/config';
import logger from '@/utils/logger';
import { ExternalServiceError, TimeoutError } from '@/utils/errors';
import { IAIService, IInvestigationInput, IInvestigationOutput } from '@/ai/aiService';
import { buildInvestigationPrompt } from '@/ai/prompts/investigatorPrompt';

function safeParseJson(text: string): IInvestigationOutput | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as unknown as IInvestigationOutput;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as unknown as IInvestigationOutput;
    } catch {
      return null;
    }
  }
}

class GroqProvider implements IAIService {
  public readonly providerName = 'groq';

  private client: Groq;
  private modelName: string;
  private timeoutMs: number;

  constructor(apiKey: string, modelName: string, timeoutMs: number) {
    this.client = new Groq({ apiKey, timeout: timeoutMs });
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
  }

  async generateInvestigation(input: IInvestigationInput): Promise<IInvestigationOutput> {
    const prompt = buildInvestigationPrompt(input);

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content:
                'You are a fintech support copilot. Output strict JSON only. Never request credentials. Never promise refunds.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: config.ai.temperature,
          max_tokens: config.ai.maxOutputTokens,
          response_format: { type: 'json_object' },
        },
        { timeout: this.timeoutMs },
      );

      const text = completion.choices?.[0]?.message?.content ?? '';
      const parsed = safeParseJson(text);
      if (!parsed) {
        logger.warn({ provider: this.providerName }, 'Groq returned non-JSON output');
        throw new ExternalServiceError('AI provider returned malformed output');
      }
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('aborted')) {
        throw new TimeoutError(`Groq request timed out after ${this.timeoutMs}ms`);
      }
      logger.error({ err: message, provider: this.providerName }, 'Groq call failed');
      throw new ExternalServiceError(`Groq call failed: ${message}`);
    }
  }
}

export function createGroqProvider(): IAIService | null {
  if (!config.ai.groq.apiKey) return null;
  return new GroqProvider(
    config.ai.groq.apiKey,
    config.ai.groq.model,
    config.ai.timeoutMs,
  );
}