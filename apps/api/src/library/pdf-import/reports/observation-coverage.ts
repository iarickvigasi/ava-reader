import { safeEventSchema, type SafeConversionEvent } from './event-contract';

export const MAX_OBSERVATION_ROWS = 20_000;
const MAX_MISSING_RANGES = 20;
const MAX_PRODUCERS = 16;
const SCOPE = 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY' as const;
type State =
  | 'RECORDED'
  | 'PARTIAL'
  | 'UNSEALED'
  | 'HISTORY_UNAVAILABLE'
  | 'INCONSISTENT'
  | 'BOUNDED_SCAN_INCOMPLETE';
export type ObservationRow = { sequence: number; event: unknown };
type Producer = {
  claim: SafeConversionEvent;
  claimSequence: number;
  ordinals: Set<number>;
  through: number;
  dropped: number;
  sealedThrough: number | null;
  inconsistent: boolean;
};
const binding = (event: SafeConversionEvent) =>
  JSON.stringify([
    event.attemptId,
    event.attemptFence,
    event.generation,
    event.cancellationEpoch,
    event.details.jobId,
    event.details.sourceSha256,
    event.details.configSha256,
    event.details.profileId,
    event.details.workerFingerprint,
  ]);
function qualified(event: SafeConversionEvent) {
  return (
    event.attemptId !== undefined &&
    event.attemptFence !== undefined &&
    event.generation !== undefined &&
    event.cancellationEpoch !== undefined &&
    event.details.jobId !== undefined &&
    event.details.sourceSha256 !== undefined &&
    event.details.configSha256 !== undefined &&
    event.details.profileId !== undefined &&
    event.details.workerFingerprint !== undefined
  );
}

// Only retained evidence at this watermark is considered. This is delivery
// completeness for declared producers, never complete measurements or fidelity.
export function projectObservationCoverage(
  rows: ObservationRow[],
  watermark: number,
  scanComplete = true,
) {
  const producers = new Map<string, Producer>();
  const historical = new Set<string>();
  let inconsistent = false,
    expectedSequence = 1,
    producerLimit = false,
    historicalUnavailable = false;
  if (rows.length > MAX_OBSERVATION_ROWS) scanComplete = false;
  const selected = rows
    .slice(0, MAX_OBSERVATION_ROWS)
    .filter((row) => row.sequence <= watermark);
  const events: { sequence: number; event: SafeConversionEvent }[] = [];
  for (const row of selected) {
    if (row.sequence !== expectedSequence++) inconsistent = true;
    const raw = row.event;
    const parsed = safeEventSchema.safeParse(raw);
    if (!parsed.success) {
      inconsistent = true;
      continue;
    }
    events.push({ sequence: row.sequence, event: parsed.data });
    const protocol = parsed.data.details.observationProtocol;
    if (parsed.data.kind === 'HISTORICAL_SNAPSHOT')
      historicalUnavailable = true;
    if (parsed.data.kind === 'CLAIMED' && !protocol) {
      historicalUnavailable = true;
      const id = parsed.data.attemptId;
      if (id && !historical.has(id)) {
        if (historical.size + producers.size === MAX_PRODUCERS)
          producerLimit = true;
        else historical.add(id);
      }
    }
    if (!protocol) continue;
    if (
      parsed.data.kind !== 'CLAIMED' ||
      !qualified(parsed.data) ||
      protocol.producerId !== parsed.data.attemptId ||
      producers.has(protocol.producerId) ||
      historical.has(protocol.producerId)
    ) {
      inconsistent = true;
      continue;
    }
    if (producers.size + historical.size === MAX_PRODUCERS) {
      producerLimit = true;
      continue;
    }
    producers.set(protocol.producerId, {
      claim: parsed.data,
      claimSequence: row.sequence,
      ordinals: new Set(),
      through: 0,
      dropped: 0,
      sealedThrough: null,
      inconsistent: false,
    });
  }
  if (scanComplete && expectedSequence !== watermark + 1) inconsistent = true;
  for (const { sequence, event } of events) {
    const { observationDelivery: delivery, observationWatermark: snapshot } =
      event.details;
    if (!delivery && !snapshot) continue;
    const id = delivery?.producerId ?? snapshot!.producerId;
    const producer = producers.get(id);
    if (
      !producer ||
      sequence <= producer.claimSequence ||
      binding(event) !== binding(producer.claim) ||
      (snapshot && snapshot.producerId !== id)
    ) {
      inconsistent = true;
      continue;
    }
    if (delivery) {
      if (producer.ordinals.has(delivery.ordinal)) producer.inconsistent = true;
      producer.ordinals.add(delivery.ordinal);
    }
    if (!snapshot) continue;
    if (
      snapshot.throughOrdinal < producer.through ||
      snapshot.reportedFailures < producer.dropped ||
      (snapshot.sealed && delivery !== undefined) ||
      (producer.sealedThrough !== null &&
        snapshot.throughOrdinal !== producer.sealedThrough)
    )
      producer.inconsistent = true;
    producer.through = Math.max(producer.through, snapshot.throughOrdinal);
    producer.dropped = Math.max(producer.dropped, snapshot.reportedFailures);
    if (snapshot.sealed) producer.sealedThrough = snapshot.throughOrdinal;
  }
  const views = [...producers.entries()].map(([producerId, producer]) => {
    const ordinals = [...producer.ordinals].sort((a, b) => a - b);
    const end =
      producer.sealedThrough ??
      Math.max(producer.through, ordinals.at(-1) ?? 0);
    if (producer.sealedThrough !== null && ordinals.some((n) => n > end))
      producer.inconsistent = true;
    const missingRanges: { first: number; last: number }[] = [];
    let next = 1,
      missingOrdinalCount = 0,
      rangeCount = 0;
    for (const ordinal of [...ordinals.filter((n) => n <= end), end + 1]) {
      if (ordinal > next) {
        missingOrdinalCount += ordinal - next;
        rangeCount++;
        if (missingRanges.length < MAX_MISSING_RANGES)
          missingRanges.push({ first: next, last: ordinal - 1 });
      }
      next = ordinal + 1;
    }
    const state: State = producer.inconsistent
      ? 'INCONSISTENT'
      : producer.sealedThrough === null
        ? 'UNSEALED'
        : missingOrdinalCount
          ? 'PARTIAL'
          : 'RECORDED';
    return {
      producerId,
      state,
      exactFinalCountKnown:
        producer.sealedThrough !== null && !producer.inconsistent,
      expectedThroughOrdinal: producer.sealedThrough,
      knownPrefixThroughOrdinal: end,
      reportedDeliveryFailuresAtLatestSnapshot: producer.dropped,
      recordedOrdinalCount: ordinals.length,
      missingOrdinalCount,
      missingRanges,
      missingRangeCoverage:
        rangeCount <= MAX_MISSING_RANGES ? 'COMPLETE' : 'BOUNDED',
    };
  });
  const state: State =
    !scanComplete || producerLimit
      ? 'BOUNDED_SCAN_INCOMPLETE'
      : inconsistent || views.some((view) => view.state === 'INCONSISTENT')
        ? 'INCONSISTENT'
        : historicalUnavailable || !views.length
          ? 'HISTORY_UNAVAILABLE'
          : views.some((view) => view.state === 'UNSEALED')
            ? 'UNSEALED'
            : views.some((view) => view.state === 'PARTIAL')
              ? 'PARTIAL'
              : 'RECORDED';
  return {
    scope: SCOPE,
    watermark,
    state,
    complete: state === 'RECORDED',
    producers: views,
    historicalProducers: [...historical].map((producerId) => ({
      producerId,
      state: 'HISTORY_UNAVAILABLE' as const,
      exactFinalCountKnown: false,
    })),
  };
}
