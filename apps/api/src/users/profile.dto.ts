import { z } from 'zod';

export const telegramUrlSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\/?$/)
  .transform((value) => value.replace(/\/$/, ''));

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    telegramUrl: z.union([telegramUrlSchema, z.null()]).optional(),
  })
  .strict();
