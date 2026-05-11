import { z } from 'zod';

// Same selection cap as ai-comments — a highlight is a paragraph-sized passage
// at most.
const EXCERPT_MAX_LENGTH = 2048;
// JSON-serialised ReaderRangeLocator (the same shape as AiCommentLocator).
const LOCATOR_MAX_LENGTH = 2048;
// Cuid2 lengths are 24-32; allow a generous range so client cuid generators
// with different settings still pass.
const ID_MIN_LENGTH = 8;
const ID_MAX_LENGTH = 64;

export const HIGHLIGHT_COLORS = [
  'apricot',
  'mimosa',
  'jade',
  'sky',
  'lavender',
  'rose',
  'mauve',
] as const;

export const annotationIdSchema = z
  .string()
  .min(ID_MIN_LENGTH)
  .max(ID_MAX_LENGTH)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Annotation id must be alphanumeric (with `-`/`_`).',
  );

export const upsertAnnotationSchema = z.object({
  excerpt: z.string().min(1).max(EXCERPT_MAX_LENGTH),
  highlightColor: z.enum(HIGHLIGHT_COLORS),
  locator: z.string().max(LOCATOR_MAX_LENGTH).optional(),
});

export type UpsertAnnotationRequest = z.infer<typeof upsertAnnotationSchema>;
