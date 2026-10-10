import { z } from 'zod';
export const streamHeader = z
  .object({
    schema_version: z.enum([
      'ava-reconstruct-stream-1',
      'ava-epub-import-stream-1',
    ]),
    report: z.unknown(),
    artifacts: z
      .array(
        z
          .object({
            path: z
              .string()
              .max(240)
              .regex(
                /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
              ),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            byte_length: z
              .number()
              .int()
              .min(1)
              .max(256 * 1024 ** 2),
          })
          .strict(),
      )
      .min(3)
      .max(1003),
  })
  .strict();
export const streamChunk = z
  .object({
    path: z.string(),
    offset: z.number().int().nonnegative(),
    base64: z
      .string()
      .max(349528)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export type StreamArtifact = z.infer<typeof streamHeader>['artifacts'][number];
export function decodeStreamLine(bytes: Buffer): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
