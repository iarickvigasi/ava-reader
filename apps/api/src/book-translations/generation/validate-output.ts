import { BadGatewayException } from '@nestjs/common';
import { z } from 'zod';
import type { BilingualUnit } from '../types';

export const translationOutputSchema = z
  .object({
    translations: z
      .array(
        z
          .object({
            id: z.string(),
            text: z.string().trim().min(1).max(131_072),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict();

export function validateTranslationOutput(
  output: unknown,
  sentences: BilingualUnit[],
): Record<string, string> {
  const parsed = translationOutputSchema.safeParse(output);
  if (!parsed.success)
    throw new BadGatewayException('The translation response was invalid.');
  const expected = new Set(sentences.map((sentence) => sentence.id));
  const received = new Set(parsed.data.translations.map((entry) => entry.id));
  if (
    received.size !== expected.size ||
    received.size !== parsed.data.translations.length ||
    [...received].some((id) => !expected.has(id))
  ) {
    throw new BadGatewayException(
      'The translation response did not match every requested sentence.',
    );
  }
  return Object.fromEntries(
    parsed.data.translations.map(({ id, text }) => [id, text]),
  );
}
