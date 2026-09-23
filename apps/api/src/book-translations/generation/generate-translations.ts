import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { generateObject } from 'ai';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import { buildBilingualPrompt } from './prompt';
import { persistTranslations } from '../storage/persist-translations';
import { readTranslations } from '../storage/read-translations';
import {
  translationOutputSchema,
  validateTranslationOutput,
} from './validate-output';
import type { BilingualUnit, TranslationContext } from '../types';

const GENERATION_DEADLINE_MS = 45_000;

export async function generateTranslations(args: {
  prisma: PrismaService;
  openrouter: OpenRouterClient;
  context: TranslationContext;
  sentences: BilingualUnit[];
  signal: AbortSignal;
  regenerate?: boolean;
}): Promise<Record<string, string>> {
  const sentenceIds = args.sentences.map((sentence) => sentence.id);
  const cached = await readTranslations({ ...args, sentenceIds });
  const missing = args.sentences.filter(
    (sentence) => args.regenerate || !cached[sentence.id],
  );
  if (!missing.length) return cached;
  args.signal.throwIfAborted();
  const modelId = args.openrouter.getModelId();
  const model = args.openrouter.getModel();
  const deadline = AbortSignal.timeout(GENERATION_DEADLINE_MS);
  const signal = AbortSignal.any([args.signal, deadline]);
  let output: unknown;
  try {
    const result = await generateObject({
      model,
      schema: translationOutputSchema,
      ...buildBilingualPrompt(args.context, missing),
      abortSignal: signal,
      maxRetries: 0,
      maxOutputTokens: 16_000,
    });
    output = result.object;
  } catch (error) {
    if (args.signal.aborted) throw error;
    if (deadline.aborted)
      throw new GatewayTimeoutException(
        'Translation took too long. Please retry.',
      );
    throw new BadGatewayException(
      'Translation could not be completed. Please retry.',
    );
  }
  signal.throwIfAborted();
  const translations = validateTranslationOutput(output, missing);
  await persistTranslations({
    ...args,
    sentences: missing,
    translations,
    modelId,
  });
  // Re-read the winning persisted values if another API instance raced us.
  return readTranslations({ ...args, sentenceIds });
}
