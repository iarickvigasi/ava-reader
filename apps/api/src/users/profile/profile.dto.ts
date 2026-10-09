import { z } from 'zod';

export const INTRODUCTION_MINIMUM = 50;
export const INTRODUCTION_LIMIT = 180;

export const telegramUrlSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\/?$/)
  .transform((value) => value.replace(/\/$/, ''));

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    introduction: z
      .string()
      .trim()
      .refine((value) => Array.from(value).length <= INTRODUCTION_LIMIT)
      .optional(),
    profilePublished: z.boolean().optional(),
    shareCurrentBook: z.boolean().optional(),
    telegramUrl: z.union([telegramUrlSchema, z.null()]).optional(),
  })
  .strict()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined));
