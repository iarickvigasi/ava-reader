import { generateObject } from 'ai';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import type { TranslationContext } from '../types';
import { alignmentOutputSchema } from './alignment-output';
import { alignmentPrompt } from './alignment-prompt';
import type { AlignmentInput } from './alignment-input';

export async function requestAlignment(
  args: {
    openrouter: OpenRouterClient;
    context: TranslationContext;
    signal: AbortSignal;
  },
  batch: AlignmentInput[],
  feedback?: string,
  previousAttempt?: unknown[],
) {
  const result = await generateObject({
    model: args.openrouter.getModel(),
    schema: alignmentOutputSchema,
    system: alignmentPrompt(feedback),
    prompt: JSON.stringify({
      ...(previousAttempt ? { previousAttempt } : {}),
      sourceLanguage: args.context.sourceLanguage,
      targetLanguage: args.context.targetLang,
      sentences: batch.map((row) => ({
        id: row.sentenceId,
        sourceText: row.sourceText,
        translatedText: row.translatedText,
        source: row.source.map(({ id, text }) => ({ id, text })),
        translation: row.translation.map(({ id, text }) => ({ id, text })),
      })),
    }),
    abortSignal: args.signal,
    maxRetries: 0,
    maxOutputTokens: 16_000,
  });
  return result.object.sentences;
}
