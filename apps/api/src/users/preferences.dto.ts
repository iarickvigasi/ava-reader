import { z } from 'zod';

// All fields optional and nullable: a missing key in the PATCH body means
// "leave this preference alone", a key set to `null` means "clear it back to
// the client default". This matches the schema where every column is nullable.

export const themeSchema = z.enum(['light', 'dark']);

export const updatePreferencesSchema = z
  .object({
    translateTargetLang: z.string().min(2).max(64).nullable().optional(),
    interfaceLang: z.string().min(2).max(16).nullable().optional(),
    theme: themeSchema.nullable().optional(),
    // The reader currently uses 0.85..1.35 in 0.1 increments. Bounds here
    // are deliberately wider so client-side range tweaks don't require a
    // server change.
    fontScale: z.number().min(0.5).max(3).nullable().optional(),
    readingGoalMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  })
  .strict();

export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;
