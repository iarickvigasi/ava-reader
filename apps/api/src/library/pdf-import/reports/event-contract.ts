import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  workerObservationResult,
  workerSourceFinding,
} from '../../../pdf-conversion/runtime/worker-observation';

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
        validationFence: z.number().int().positive().optional(),
        validationVerdict: z.enum(['PASS', 'REVIEW', 'BLOCKED']).optional(),
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
        unitId: reportId.optional(),
        outcome: z
          .enum(['COMPLETED', 'FAILED', 'ABORTED', 'UNOBSERVED'])
          .optional(),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().optional(),
        timingScope: z
          .literal('COORDINATOR_UNIT_INCLUSIVE_WALL_NOT_SUMMABLE')
          .optional(),
        timingStatus: z.enum(['MEASURED', 'UNOBSERVED']).optional(),
        workerObservation: workerObservationResult.optional(),
        failureCode: z
          .string()
          .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
          .optional(),
        sourceFindings: z
          .object({
            stage: z.enum(['extraction', 'assembly']),
            findings: z.array(workerSourceFinding).max(2),
            complete: z.boolean(),
          })
          .strict()
          .optional(),
        cacheReuse: z
          .object({
            kind: z.literal('PROVIDER_RECEIPT'),
            reused: z.boolean(),
          })
          .strict()
          .optional(),
        preparedRoute: z
          .object({
            pageNumber: z.number().int().min(1).max(500),
            route: z.enum(['NATIVE', 'RECOGNITION', 'HYBRID', 'BLANK']),
            nativeSegments: z.number().int().nonnegative().max(100_000),
            recognitionTasks: z.number().int().nonnegative().max(100_000),
          })
          .strict()
          .optional(),
        outputInventory: z
          .object({
            scope: z.literal('VALIDATED_CANONICAL_OUTPUT'),
            chapters: z.number().int().nonnegative().max(20_000),
            blocks: z.number().int().nonnegative().max(20_000),
            resources: z.number().int().nonnegative().max(1000),
            styles: z.number().int().nonnegative().max(100_000),
            metadataClaims: z.number().int().nonnegative().max(100_000),
            figures: z.number().int().nonnegative().max(20_000),
            tables: z.number().int().nonnegative().max(20_000),
            notes: z.number().int().nonnegative().max(20_000),
            languages: z
              .object({
                en: z.number().int().nonnegative().max(100_000_000),
                uk: z.number().int().nonnegative().max(100_000_000),
                und: z.number().int().nonnegative().max(100_000_000),
                unknown: z.number().int().nonnegative().max(100_000_000),
              })
              .strict(),
            links: z
              .object({
                internal: z.number().int().nonnegative().max(100_000_000),
                note: z.number().int().nonnegative().max(100_000_000),
                external: z.number().int().nonnegative().max(100_000_000),
              })
              .strict(),
          })
          .strict()
          .optional(),
        routeSelection: z
          .object({
            routeId: reportId,
            providerSlug: reportId,
            modelId: z
              .string()
              .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/)
              .refine((value) => !/^(?:sk[-_]|bearer|https?:)/i.test(value)),
            configurationSha256: digest,
            evidence: z.literal('IMMUTABLE_ROUTE_SELECTION'),
            observedProvider: z.literal('UNKNOWN'),
          })
          .strict()
          .optional(),
        observationCapture: z
          .object({
            pending: z.number().int().nonnegative().max(16),
            lost: z.number().int().nonnegative().max(100_000),
            state: z.enum(['PENDING', 'PARTIAL', 'RECORDED']),
            scope: z.literal('PRECEDING_QUEUE_AT_PRODUCER_OBSERVATION'),
          })
          .strict()
          .optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((value, context) => {
    for (const finding of value.details.sourceFindings?.findings ?? [])
      if (
        finding.box.x0 < finding.region_box.x0 ||
        finding.box.y0 < finding.region_box.y0 ||
        finding.box.x1 > finding.region_box.x1 ||
        finding.box.y1 > finding.region_box.y1
      )
        context.addIssue({
          code: 'custom',
          message: 'Source finding exceeds qualified region',
        });
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
