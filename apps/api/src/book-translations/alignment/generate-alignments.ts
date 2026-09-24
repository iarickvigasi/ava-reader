import { BadGatewayException, Logger } from '@nestjs/common';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import type { BilingualUnit, SentenceAlignment } from '../types';
import { AlignmentValidationError } from './alignment-output';
import { alignmentTokens } from './alignment-tokens';
import {
  rowsFor,
  currentAlignment,
  readAlignments,
  type AlignmentReadArgs,
} from './alignment-storage';
import { requestAlignment } from './request-alignment';
import { saveAlignment } from './save-alignment';
import type { AlignmentInput } from './alignment-input';

export async function generateAlignments(
  args: AlignmentReadArgs & {
    openrouter: OpenRouterClient;
    sentences: BilingualUnit[];
    signal: AbortSignal;
    regenerate?: boolean;
  },
): Promise<Record<string, SentenceAlignment>> {
  args.signal.throwIfAborted();
  const sentenceIds = args.sentences.map((unit) => unit.id);
  const rows = await rowsFor({ ...args, sentenceIds });
  const missing = rows.filter(
    (row) => args.regenerate || !currentAlignment(row),
  );
  if (!missing.length) return readAlignments({ ...args, sentenceIds });
  const inputs = missing.map((row) => ({
    ...row,
    source: alignmentTokens(row.sourceText, args.context.sourceLanguage),
    translation: alignmentTokens(row.translatedText, args.context.targetLang),
  }));
  const regenerated = new Set<string>();
  const readResult = async () => {
    const saved = await readAlignments({ ...args, sentenceIds });
    return args.regenerate
      ? Object.fromEntries(
          Object.entries(saved).filter(([id]) => regenerated.has(id)),
        )
      : saved;
  };
  const signal = AbortSignal.any([args.signal, AbortSignal.timeout(45_000)]);
  const request = (
    batch: AlignmentInput[],
    feedback?: string,
    previousAttempt?: unknown[],
  ) => requestAlignment({ ...args, signal }, batch, feedback, previousAttempt);
  const logger = new Logger('SentenceAlignments');
  let failure: { reason: unknown } | undefined;
  try {
    const outputs = await request(inputs);
    const results = await Promise.allSettled(
      inputs.map(async (row) => {
        let candidates = outputs;
        for (let attempt = 0; attempt <= 2; attempt++) {
          signal.throwIfAborted();
          try {
            if (await saveAlignment(args.prisma, row, candidates, signal))
              regenerated.add(row.sentenceId);
            return;
          } catch (error) {
            if (signal.aborted) throw error;
            // Only deterministic validation failures should be sent back to the model.
            if (!(error instanceof AlignmentValidationError)) throw error;
            logger.warn(
              `Sentence ${row.sentenceId}, attempt ${attempt + 1}: ${error.message}`,
            );
            if (attempt === 2) return;
            candidates = await request(
              [row],
              error.message,
              candidates.filter((candidate) => candidate.id === row.sentenceId),
            );
          }
        }
      }),
    );
    failure = results.find((result) => result.status === 'rejected');
    args.signal.throwIfAborted();
  } catch (error) {
    failure = { reason: error };
  }
  if (failure) {
    const error = failure.reason;
    if (args.signal.aborted) throw error;
    logger.error(
      `Alignment generation failed: ${error instanceof Error ? error.name : 'Unknown error'}`,
    );
    // Successful sentences survive a failed retry or the shared deadline.
    const saved = await readResult();
    if (Object.keys(saved).length) return saved;
    throw new BadGatewayException(
      'Phrase matching could not be completed. Please retry.',
    );
  }
  return readResult();
}
