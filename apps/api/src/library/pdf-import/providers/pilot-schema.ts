import { z } from 'zod';
const hash = z.string().regex(/^[a-f0-9]{64}$/),
  id = z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/);
export const pilotInventorySchema = z
  .object({
    version: z.literal(1),
    workerFingerprint: hash,
    maxRequests: z.number().int().min(1).max(64),
    totalLimitNano: z.literal('1000000000'),
    operations: z
      .array(
        z
          .object({
            operationId: id,
            ownerId: id,
            sourceSha256: hash,
            operationLimitNano: z.string(),
            tasks: z
              .array(
                z
                  .object({
                    taskId: id,
                    taskSha256: hash,
                    requestSha256: hash,
                    renderSha256: hash,
                  })
                  .strict(),
              )
              .min(1)
              .max(64),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict();
export type PilotInventory = z.infer<typeof pilotInventorySchema>;
