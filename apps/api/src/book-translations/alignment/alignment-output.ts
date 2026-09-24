import { z } from 'zod';

export class AlignmentValidationError extends Error {}

export const alignmentOutputSchema = z.object({
  sentences: z.array(
    z.object({
      id: z.string(),
      groups: z.array(
        z.object({
          sourceText: z.array(z.string()).min(1),
          translationText: z.array(z.string()).min(1),
          source: z.array(z.number().int().nonnegative()).min(1),
          translation: z.array(z.number().int().nonnegative()).min(1),
        }),
      ),
    }),
  ),
});

export type AlignmentOutput = z.infer<
  typeof alignmentOutputSchema
>['sentences'][number];
