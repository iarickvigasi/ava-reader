import { z } from 'zod';
import { AiCommentKind } from '@prisma/client';

// Per-tool output schemas. The Vercel AI SDK uses these to coerce the model
// into structured JSON and to validate the partial objects it streams back —
// we only ever emit the named field's text to the client, so any extra keys
// the model decides to add (preamble, language labels, "I'm ready to…") are
// dropped before they reach the panel.

export const translateOutputSchema = z.object({
  translation: z.string(),
});

export const etymologyOutputSchema = z.object({
  etymology: z.string(),
});

export const explainOutputSchema = z.object({
  explanation: z.string(),
});

// String-typed names of the field each schema exposes. Kept as a literal
// union so the controller's stream loop can index into the partial object
// safely.
export type AiToolOutputField = 'translation' | 'etymology' | 'explanation';

export type AiToolOutputSpec = {
  schema:
    | typeof translateOutputSchema
    | typeof etymologyOutputSchema
    | typeof explainOutputSchema;
  fieldKey: AiToolOutputField;
};

export function getOutputSpec(kind: AiCommentKind): AiToolOutputSpec {
  switch (kind) {
    case AiCommentKind.TRANSLATE:
      return { schema: translateOutputSchema, fieldKey: 'translation' };
    case AiCommentKind.ETYMOLOGY:
      return { schema: etymologyOutputSchema, fieldKey: 'etymology' };
    case AiCommentKind.EXPLAIN:
      return { schema: explainOutputSchema, fieldKey: 'explanation' };
    default: {
      // Exhaustiveness guard.
      const exhaustive: never = kind;
      throw new Error(`Unknown AI tool kind: ${String(exhaustive)}`);
    }
  }
}
