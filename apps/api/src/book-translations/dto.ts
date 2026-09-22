import { z } from 'zod';
import { MAX_TRANSLATION_SENTENCES } from './types';

export const translationQuerySchema = z.object({
  targetLang: z.string().trim().min(2).max(64),
});

export const generateTranslationSchema = translationQuerySchema.extend({
  chapterId: z.string().min(1).max(1024),
  contentRevision: z.string().min(1).max(256),
  translationVersion: z.number().int().positive(),
  sentenceIds: z
    .array(z.string().min(1).max(128))
    .min(1)
    .max(MAX_TRANSLATION_SENTENCES)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Duplicate sentence IDs.',
    ),
});

export type GenerateTranslationRequest = z.infer<
  typeof generateTranslationSchema
>;
