import type { SafeConversionEvent } from './event-contract';

export type MeasurementRecord = {
  operationKey: string | null;
  jobId: string | null;
  sourceSha256: string | null;
  configSha256: string | null;
  profileId: string | null;
  workerFingerprint: string | null;
};
type Availability = 'AVAILABLE' | 'PARTIAL' | 'NOT_OBSERVED';
const limits = [
  'COMMAND_TIMING_EXCLUDES_STARTUP_AND_EXPORT',
  'NESTED_PHASES_NOT_SUMMABLE',
  'CPU_SELF_AND_REAPED_CHILDREN_ONLY',
  'RSS_WORKER_LIFETIME_MAX_NOT_CONTAINER_PEAK',
  'SCRATCH_LOGICAL_BYTES_AT_COMMAND_END_NOT_PEAK',
  'LANGUAGE_HEURISTIC_LAYOUT_MAY_BE_UNKNOWN',
  'ANNOTATIONS_ORIGINAL_TOP_LEVEL_OBJECTS_ONLY',
  'REUSE_ATTEMPT_PRIVATE_AND_PROCESS_LOCAL_NOT_SAVED_PROVIDER_CALLS',
  'AVAILABILITY_NOT_ALL_COMMANDS_OR_SOURCE_FIDELITY',
  'WORKER_OUTCOME_DISTINCT_FROM_COORDINATOR_OUTCOME',
] as const;
const envelope = (event: SafeConversionEvent) =>
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

// Read-derived availability, never a measurement total or mutation of authority.
// The retained scan already has a 20k-row bound; only16 claim identities remain here.
export function workerMeasurements(record?: MeasurementRecord) {
  const claims = new Map<string, string>(),
    seen = new Set<string>();
  let packetCount = 0,
    rejectedPacketCount = 0,
    missingPacketCount = 0,
    resourcePackets = 0,
    inventoryPackets = 0;
  let claimsBounded = true,
    failure: string | null = null;
  const matchesRecord = (event: SafeConversionEvent) =>
    Boolean(
      record?.operationKey &&
      event.details.jobId === record.jobId &&
      event.details.sourceSha256 === record.sourceSha256 &&
      event.details.configSha256 === record.configSha256 &&
      event.details.profileId === record.profileId &&
      event.details.workerFingerprint === record.workerFingerprint,
    );
  return {
    missingCommand() {
      missingPacketCount++;
    },
    observe(event: SafeConversionEvent) {
      if (
        event.kind === 'CLAIMED' &&
        event.attemptId &&
        matchesRecord(event) &&
        event.details.observationProtocol?.producerId === event.attemptId
      ) {
        if (claims.has(event.attemptId) || claims.size === 16)
          claimsBounded = false;
        else claims.set(event.attemptId, envelope(event));
      }
      const observation = event.details.workerObservation;
      if (observation?.status !== 'OBSERVED') {
        if (event.kind === 'STAGE_ENDED' && event.stage === 'WORKER_COMMAND')
          missingPacketCount++;
        return;
      }
      const packet = observation.packet,
        bound = packet.binding;
      const key = `${bound.attempt_id}:${bound.unit_id}`;
      if (
        !matchesRecord(event) ||
        event.kind !== 'STAGE_ENDED' ||
        event.stage !== 'WORKER_COMMAND' ||
        event.details.observationDelivery?.producerId !== event.attemptId ||
        claims.get(bound.attempt_id) !== envelope(event) ||
        bound.operation_id !== record?.operationKey ||
        bound.attempt_id !== event.attemptId ||
        bound.attempt_fence !== event.attemptFence ||
        bound.generation !== event.generation ||
        bound.cancellation_epoch !== event.cancellationEpoch ||
        bound.job_id !== event.details.jobId ||
        bound.source_sha256 !== event.details.sourceSha256 ||
        bound.config_sha256 !== event.details.configSha256 ||
        bound.profile_id !== event.details.profileId ||
        bound.worker_fingerprint !== event.details.workerFingerprint ||
        bound.unit_id !== event.details.unitId ||
        (packet.outcome.toUpperCase() !== event.details.outcome &&
          !(
            packet.outcome === 'completed' &&
            event.details.outcome === 'FAILED' &&
            event.details.failureCode === 'INVALID_RESULT'
          )) ||
        seen.has(key)
      ) {
        rejectedPacketCount++;
        return;
      }
      seen.add(key);
      packetCount++;
      const resources = packet.resources;
      if (
        resources.cpu_self_ms !== null &&
        resources.cpu_finished_children_ms !== null &&
        resources.peak_rss_bytes !== null &&
        resources.scratch_current_bytes !== null
      )
        resourcePackets++;
      if (packet.inventory.coverage === 'full') inventoryPackets++;
      if (packet.failure_code) failure = packet.failure_code;
    },
    finish(scanComplete: boolean) {
      const state = (available: number): Availability =>
        !packetCount
          ? 'NOT_OBSERVED'
          : scanComplete &&
              claimsBounded &&
              !rejectedPacketCount &&
              !missingPacketCount &&
              available === packetCount
            ? 'AVAILABLE'
            : 'PARTIAL';
      return {
        scope: 'BOUND_RECORDED_WORKER_COMMANDS_AT_WATERMARK' as const,
        packetCount,
        rejectedPacketCount,
        missingPacketCount,
        scanComplete,
        workDurations: state(packetCount),
        checkpointReuse: state(packetCount),
        resources: state(resourcePackets),
        inventory: state(inventoryPackets),
        sourceFidelity: 'NOT_ESTABLISHED' as const,
        failureCode: failure,
        limitations: [...limits],
      };
    },
  };
}
export type WorkerMeasurements = ReturnType<
  ReturnType<typeof workerMeasurements>['finish']
>;
export function measurementEvidenceGaps(
  gaps: string[],
  summary?: WorkerMeasurements,
) {
  if (!summary) return gaps;
  const replacements: Record<string, [Availability, string]> = {
    WORKER_WORK_DURATIONS: [
      summary.workDurations,
      'WORKER_TIMING_OUTSIDE_RECORDED_COMMANDS',
    ],
    CHECKPOINT_REUSE: [
      summary.checkpointReuse,
      'REUSE_OUTSIDE_RECORDED_WORKER_SCOPE',
    ],
    CPU_RSS_SCRATCH: [
      summary.resources,
      'RESOURCES_OUTSIDE_RECORDED_WORKER_PROCESS',
    ],
    DETECTED_LANGUAGE_LAYOUT_ANNOTATION_INVENTORY: [
      summary.inventory,
      'INVENTORY_DETECTION_HEURISTIC_OR_UNKNOWN',
    ],
  };
  return gaps.map((gap) =>
    replacements[gap]?.[0] === 'AVAILABLE' ? replacements[gap][1] : gap,
  );
}
