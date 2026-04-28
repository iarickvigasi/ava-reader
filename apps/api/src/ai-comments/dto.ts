import { z } from 'zod';

// Selection length cap. The reader only ever surfaces user-highlighted text,
// so 2 KB is plenty for a paragraph-sized passage and refuses anything that
// looks like a whole chapter dump.
const SELECTION_MAX_LENGTH = 2048;
const CONTEXT_MAX_LENGTH = SELECTION_MAX_LENGTH * 4;
const META_MAX_LENGTH = 200;

const baseSchema = z.object({
  text: z.string().min(1).max(SELECTION_MAX_LENGTH),
  locator: z.string().max(512).optional(),
});

export const translateSchema = baseSchema.extend({
  // Free-form on purpose. The frontend may send the user-friendly label
  // ("French (Français)") and the model handles it just fine — we don't want
  // to maintain a closed set of language codes here.
  targetLang: z.string().min(2).max(64),
});

export const etymologySchema = baseSchema;

export const explainSchema = baseSchema.extend({
  context: z.string().max(CONTEXT_MAX_LENGTH).optional(),
  bookTitle: z.string().max(META_MAX_LENGTH).optional(),
  author: z.string().max(META_MAX_LENGTH).optional(),
});

export type TranslateRequest = z.infer<typeof translateSchema>;
export type EtymologyRequest = z.infer<typeof etymologySchema>;
export type ExplainRequest = z.infer<typeof explainSchema>;
