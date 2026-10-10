import { z } from 'zod';

const producerId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.:-]+$/)
  .refine((value) => !/^(?:sk[-_]|bearer|https?:)/i.test(value));
export const MAX_OBSERVATION_ORDINAL = 100_000;
const ordinal = z.number().int().nonnegative().max(MAX_OBSERVATION_ORDINAL);
const scope = z.literal('COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY');
export const observationProtocol = z
  .object({ version: z.literal(1), producerId, scope })
  .strict();
export const observationDelivery = z
  .object({ producerId, ordinal: ordinal.min(1) })
  .strict();
export const observationWatermark = z
  .object({
    version: z.literal(1),
    producerId,
    throughOrdinal: ordinal,
    reportedFailures: ordinal,
    sealed: z.boolean(),
    scope,
  })
  .strict();
export type ObservationWatermark = z.infer<typeof observationWatermark>;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const binding = z
  .object({
    jobId: producerId,
    sourceSha256: digest,
    configSha256: digest,
    profileId: producerId,
    workerFingerprint: digest,
  })
  .strict();

// Optional metadata is never authority and cannot reject existing work.
export function safeObservationWatermark(value: unknown, attemptId: string) {
  try {
    const parsed = observationWatermark.safeParse(value);
    return parsed.success && parsed.data.producerId === attemptId
      ? parsed.data
      : undefined;
  } catch {
    return undefined;
  }
}
export function readObservationWatermark(
  input: { observationWatermark?: unknown },
  attemptId: string,
) {
  try {
    return safeObservationWatermark(input.observationWatermark, attemptId);
  } catch {
    return undefined;
  }
}
export function observationWatermarkDetails(
  value: unknown,
  attemptId: string | undefined,
  context: () => unknown,
  allowSealed = false,
) {
  try {
    const snapshot = attemptId
      ? safeObservationWatermark(value, attemptId)
      : undefined;
    if (!snapshot || (snapshot.sealed && !allowSealed)) return {};
    const identity = binding.safeParse(context());
    return snapshot && identity.success
      ? { ...identity.data, observationWatermark: snapshot }
      : {};
  } catch {
    return {};
  }
}
