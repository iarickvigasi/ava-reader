import { createHash } from 'node:crypto';
import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const reportId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.:-]+$/)
  .refine((value) => !/^(?:sk[-_]|bearer|https?:)/i.test(value));
const location = z
  .object({
    pageNumber: z.number().int().min(1).max(10_000).optional(),
    regionId: reportId.optional(),
    annotationNumber: z.number().int().min(1).max(5_000).optional(),
    relationshipPath: z
      .array(z.enum(['/Popup', '/Parent', '/IRT']))
      .max(20)
      .optional(),
  })
  .strict();
export const safeEventSchema = z
  .object({
    kind: z.enum([
      'ADMISSION_REQUEST',
      'ADMISSION_COMPLETED',
      'ADMISSION_REFUSED',
      'SOURCE_VALIDATED',
      'SOURCE_INSPECTED',
      'IMPORT_ACCEPTED',
      'QUEUED',
      'CLAIMED',
      'STAGE_STARTED',
      'STAGE_ENDED',
      'PROGRESS',
      'RECOVERED',
      'PROVIDER_RESERVED',
      'PROVIDER_DISPATCH',
      'PROVIDER_SETTLED',
      'PROVIDER_UNCERTAIN',
      'PROVIDER_RELEASED',
      'VALIDATION',
      'REVIEW_DECISION',
      'PUBLISHED',
      'FAILED',
      'STOPPED',
      'REUSE_OBSERVED',
      'HISTORICAL_SNAPSHOT',
    ]),
    stage: z.string().regex(/^[A-Z_]{1,40}$/),
    severity: z.enum(['INFO', 'WARN', 'ERROR']).default('INFO'),
    code: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
      .optional(),
    attemptId: reportId.optional(),
    attemptFence: z.number().int().nonnegative().optional(),
    generation: z.number().int().positive().optional(),
    cancellationEpoch: z.number().int().nonnegative().optional(),
    observedAt: z.string().datetime().optional(),
    durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
    durationKind: z.enum(['MEASURED_WORK', 'OBSERVED_WALL_CLOCK']).optional(),
    details: z
      .object({
        sourceSha256: digest.optional(),
        configSha256: digest.optional(),
        profileId: reportId.optional(),
        workerFingerprint: digest.optional(),
        sourceBytes: z.number().int().nonnegative().optional(),
        sourcePages: z.number().int().positive().max(10_000).optional(),
        requestAttemptId: reportId.optional(),
        operationId: reportId.optional(),
        jobId: reportId.optional(),
        callId: reportId.optional(),
        providerEventId: reportId.optional(),
        failureId: reportId.optional(),
        validationId: reportId.optional(),
        publicationId: reportId.optional(),
        finalContentId: reportId.optional(),
        purpose: z.enum(['transcribe_region', 'resolve_structure']).optional(),
        pageIndices: z
          .array(z.number().int().nonnegative().max(9_999))
          .max(512)
          .optional(),
        completed: z.number().int().nonnegative().max(10_000).optional(),
        total: z.number().int().positive().max(10_000).optional(),
        decision: z.enum(['APPROVE', 'REJECT']).optional(),
        findingCount: z.number().int().nonnegative().max(100_000).optional(),
        locations: z.array(location).max(100).optional(),
        declaredLanguages: z
          .array(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/))
          .max(10)
          .optional(),
        detectedLanguages: z
          .array(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/))
          .max(10)
          .optional(),
        layout: z
          .enum(['SINGLE_COLUMN', 'DOUBLE_COLUMN', 'MIXED', 'UNKNOWN'])
          .optional(),
        annotationCount: z.number().int().nonnegative().max(100_000).optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.durationMs === undefined) !== (value.durationKind === undefined))
      context.addIssue({
        code: 'custom',
        message: 'Duration requires a measured kind',
      });
  });
export type SafeConversionEvent = z.infer<typeof safeEventSchema>;
export function eventIdentity(producerKey: string, event: SafeConversionEvent) {
  if (!producerKey || producerKey.length > 512)
    throw new Error('PDF_EVENT_KEY_INVALID');
  const parsed = safeEventSchema.parse(event);
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  return {
    event: parsed,
    producerKey: hash(producerKey),
    payloadSha256: hash(JSON.stringify(parsed)),
  };
}
