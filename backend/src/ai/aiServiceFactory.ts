/**
 * AI service factory.
 *
 * Picks the provider per the AI_PROVIDER env var and falls back automatically
 * when the primary provider fails. Always returns a usable IAIService — the
 * rule-based provider is the guaranteed fallback.
 */

import config from '@/config';
import { AIProvider } from '@/constants/enums';
import logger from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';
import { IAIService, IInvestigationInput, IInvestigationOutput } from '@/ai/aiService';
import { createGeminiProvider } from '@/ai/geminiProvider';
import { createGroqProvider } from '@/ai/groqProvider';
import { ruleBasedProvider } from '@/ai/ruleBasedProvider';

export async function runInvestigation(
  input: IInvestigationInput,
): Promise<{ output: IInvestigationOutput; providerUsed: string }> {
  const providers: IAIService[] = [];

  if (config.ai.provider === AIProvider.RULE_ONLY) {
    const out = await ruleBasedProvider.generateInvestigation(input);
    return { output: out, providerUsed: ruleBasedProvider.providerName };
  }

  if (config.ai.provider === AIProvider.PRIMARY) {
    const gemini = createGeminiProvider();
    const groq = createGroqProvider();
    if (gemini) providers.push(gemini);
    if (groq) providers.push(groq);
  } else if (config.ai.provider === AIProvider.GROQ) {
    const groq = createGroqProvider();
    if (groq) providers.push(groq);
    const gemini = createGeminiProvider();
    if (gemini) providers.push(gemini);
  }

  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      const out = await provider.generateInvestigation(input);
      logger.info({ provider: provider.providerName }, 'AI provider succeeded');
      return { output: out, providerUsed: provider.providerName };
    } catch (err) {
      lastError = err;
      logger.warn(
        { provider: provider.providerName, err: err instanceof Error ? err.message : 'unknown' },
        'AI provider failed, trying next',
      );
    }
  }

  if (providers.length === 0) {
    logger.warn('No AI providers available — using rule-based fallback');
  } else {
    logger.error(
      { err: lastError instanceof Error ? lastError.message : 'unknown' },
      'All AI providers failed — using rule-based fallback',
    );
  }

  try {
    const out = await ruleBasedProvider.generateInvestigation(input);
    return { output: out, providerUsed: ruleBasedProvider.providerName };
  } catch (err) {
    throw new ExternalServiceError(
      `All providers failed including rule-based: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}