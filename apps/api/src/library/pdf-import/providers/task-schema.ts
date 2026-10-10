import { z } from 'zod';
const content = z.union([
  z.string(),
  z
    .array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }).strict(),
        z
          .object({
            type: z.literal('image_url'),
            image_url: z
              .object({
                url: z
                  .string()
                  .regex(
                    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/,
                  ),
              })
              .strict(),
          })
          .strict(),
      ]),
    )
    .min(1)
    .max(16),
]);
export const providerTaskSchema = z
  .object({
    taskId: z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/),
    purpose: z.enum(['transcribe_region', 'resolve_structure']),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    pageIndices: z.array(z.number().int().min(0).max(499)).min(1).max(500),
    promptVersion: z.string().min(1).max(100),
    schemaVersion: z.string().min(1).max(100),
    messages: z
      .array(z.object({ role: z.enum(['system', 'user']), content }).strict())
      .min(2)
      .max(8),
    responseSchema: z.record(z.string(), z.unknown()),
  })
  .strict();
