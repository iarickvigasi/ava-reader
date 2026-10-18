import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const anchorContextProjectionEvidence = z
  .object({
    method: z.literal('ava-anchor-context-bounds-1'),
    rawResponseSha256: digest,
    derivedResponseSha256: digest,
    originalResponseSha256: digest,
    slots: z
      .array(
        z
          .object({
            segmentIndex: z.number().int().nonnegative().max(100_000),
            spanIndex: z.number().int().nonnegative().max(100_000),
            codePointStart: z.number().int().nonnegative().max(100_000_000),
            originalBefore: z.number().int().nonnegative().max(4096),
            originalAfter: z.number().int().nonnegative().max(4096),
            finalBefore: z.number().int().nonnegative().max(128),
            finalAfter: z.number().int().nonnegative().max(128),
          })
          .strict(),
      )
      .min(1)
      .max(512),
  })
  .strict();
export type AnchorContextProjection = z.infer<
  typeof anchorContextProjectionEvidence
>;
