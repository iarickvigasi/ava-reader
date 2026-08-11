import { z } from 'zod';

// Chapter purposes live as a Zod enum rather than a Prisma enum: the analysis
// is stored in a JSON column (so Postgres would not enforce it anyway), and
// this same enum is what constrains the model's structured output. One
// definition serves the model constraint, runtime validation, and the TS type
// — and adding a label later needs no migration.
const CHAPTER_PURPOSES = [
  'BODY',
  'FRONT_MATTER',
  'TOC',
  'PREFACE',
  'AFTERWORD',
  'APPENDIX',
  'NOTES',
  'REFERENCES',
  'INDEX',
  'GLOSSARY',
  'PROMOTIONAL',
  'UNKNOWN',
] as const;

const chapterPurposeSchema = z.enum(CHAPTER_PURPOSES);
export type ChapterPurpose = z.infer<typeof chapterPurposeSchema>;

const chapterConfidenceSchema = z.enum(['high', 'low']);
export type ChapterConfidence = z.infer<typeof chapterConfidenceSchema>;

// The model echoes a chapter's numeric index, not its chapterId. Ids are
// href-derived slugs (`part0008-split-002`) — long enough to cost real tokens
// across a whole book, and they would smuggle the source filename into the
// prompt, which is exactly the untrusted noise `normalize-title` strips out.
export const chapterPurposeOutputSchema = z.object({
  chapters: z.array(
    z.object({
      confidence: chapterConfidenceSchema,
      index: z.number().int().nonnegative(),
      purpose: chapterPurposeSchema,
    }),
  ),
});

export type ChapterPurposeOutput = z.infer<typeof chapterPurposeOutputSchema>;

// Shape of the persisted `BookAnalysis.result`. Bump alongside
// `BookAnalysis.schemaVersion` when this changes.
export const CHAPTER_PURPOSE_SCHEMA_VERSION = 1;
