import type { PrismaService } from '../../../prisma/prisma.service';
import type { UsersService } from '../../../users/users.service';
import type { AuthenticatedRequest } from '../../../auth/authenticated-request';
import { PdfConversionReportsController } from '../pdf-conversion-reports.controller';
import { measurementPacket } from './worker-measurements-fixture';
import { REPORT_GAPS } from './record';
import { projectConversionCost } from './cost-projection';
import { eventPageCursor } from './cursor';
import { safeEventSchema, type SafeConversionEvent } from './event-contract';

const packet = measurementPacket,
  binding = packet.binding;
const record = {
  id: binding.operation_id,
  operationId: binding.operation_id,
  operationKey: binding.operation_id,
  jobId: binding.job_id,
  sourceSha256: binding.source_sha256,
  configSha256: binding.config_sha256,
  profileId: binding.profile_id,
  workerFingerprint: binding.worker_fingerprint,
  coverage: 'API_LIFECYCLE',
  status: 'FAILED',
  stage: 'RECONSTRUCTION',
  evidenceGaps: REPORT_GAPS,
  nextSequence: 3,
  createdAt: new Date(packet.started_at),
  updatedAt: new Date(packet.ended_at),
  retentionPolicyId: null,
};
const envelope = {
  attemptId: binding.attempt_id,
  attemptFence: binding.attempt_fence,
  generation: binding.generation,
  cancellationEpoch: binding.cancellation_epoch,
  details: {
    jobId: binding.job_id,
    sourceSha256: binding.source_sha256,
    configSha256: binding.config_sha256,
    profileId: binding.profile_id,
    workerFingerprint: binding.worker_fingerprint,
  },
};
function fixture(
  change: (value: ReturnType<typeof rows>) => void = () => {},
  scope = record,
) {
  const events = rows();
  change(events);
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(scope),
    },
    pdfConversionEvent: {
      findMany: jest.fn(
        ({
          where,
          take,
        }: {
          where: { sequence: { gt: number; lte: number } };
          take: number;
        }) =>
          Promise.resolve(
            events
              .filter(
                (row) =>
                  row.sequence > where.sequence.gt &&
                  row.sequence <= where.sequence.lte,
              )
              .slice(0, take),
          ),
      ),
    },
    pdfConversionCost: {
      findUnique: jest.fn().mockResolvedValue({
        ...projectConversionCost([], true),
        knownActualNano: 0n,
        reservedNano: 0n,
        uncertainNano: 0n,
        reconciledAt: new Date(),
      }),
    },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ roleMemberships: [{ role: 'ADMIN' }] }),
    },
    $transaction: jest.fn((work: (value: typeof tx) => unknown) =>
      Promise.resolve(work(tx)),
    ),
  };
  const users = { assertAdmin: jest.fn().mockResolvedValue({ id: 'admin' }) };
  const controller = new PdfConversionReportsController(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
  );
  return {
    tx,
    exported: () =>
      controller.export(
        { auth: { clerkUserId: 'synthetic-admin' } } as AuthenticatedRequest,
        scope.id,
        eventPageCursor(scope.id, 3, 0),
        '1',
      ),
    snapshot: () =>
      controller.snapshot(
        { auth: { clerkUserId: 'synthetic-admin' } } as AuthenticatedRequest,
        scope.id,
      ),
  };
}
function observedPacket(events: ReturnType<typeof rows>) {
  const observation = events[1].details.workerObservation;
  if (observation?.status !== 'OBSERVED')
    throw new Error('AUTHORED_FIXTURE_INVALID');
  return observation.packet;
}
function rows(): (SafeConversionEvent & {
  sequence: number;
  createdAt: Date;
})[] {
  return [
    {
      ...structuredClone(envelope),
      sequence: 1,
      kind: 'CLAIMED',
      stage: 'PREFLIGHT',
      severity: 'INFO',
      details: {
        ...envelope.details,
        observationProtocol: {
          version: 1,
          producerId: binding.attempt_id,
          scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
        },
      },
    },
    {
      ...structuredClone(envelope),
      sequence: 2,
      kind: 'STAGE_ENDED',
      stage: 'WORKER_COMMAND',
      severity: 'WARN',
      details: {
        ...envelope.details,
        unitId: binding.unit_id,
        outcome: 'FAILED',
        observationDelivery: { producerId: binding.attempt_id, ordinal: 1 },
        workerObservation: {
          status: 'OBSERVED',
          packet: structuredClone(packet),
        },
      },
    },
    {
      ...structuredClone(envelope),
      sequence: 3,
      kind: 'FAILED',
      stage: 'RECONSTRUCTION',
      severity: 'ERROR',
      code: 'INVALID_RESULT',
      details: {
        ...envelope.details,
        observationWatermark: {
          version: 1,
          producerId: binding.attempt_id,
          throughOrdinal: 1,
          reportedFailures: 0,
          sealed: true,
          scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
        },
      },
    },
  ].map(({ sequence, ...event }) => ({
    sequence,
    createdAt: new Date(packet.ended_at),
    ...safeEventSchema.parse(event),
  }));
}
it('shows available bound failed-command measurements without changing capture/outcome or claiming known layout/fidelity', async () => {
  const f = fixture(),
    snapshot = await f.snapshot();
  expect(snapshot).toMatchObject({
    coverage: 'API_LIFECYCLE',
    status: 'FAILED',
    evidenceGaps: [
      'WORKER_TIMING_OUTSIDE_RECORDED_COMMANDS',
      'REUSE_OUTSIDE_RECORDED_WORKER_SCOPE',
      'RESOURCES_OUTSIDE_RECORDED_WORKER_PROCESS',
      'INVENTORY_DETECTION_HEURISTIC_OR_UNKNOWN',
    ],
    workerMeasurements: {
      scope: 'BOUND_RECORDED_WORKER_COMMANDS_AT_WATERMARK',
      packetCount: 1,
      scanComplete: true,
      workDurations: 'AVAILABLE',
      checkpointReuse: 'AVAILABLE',
      resources: 'AVAILABLE',
      inventory: 'AVAILABLE',
      sourceFidelity: 'NOT_ESTABLISHED',
      failureCode: 'RECONSTRUCTION_REVIEW_REQUIRED',
      limitations: [
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
      ],
    },
    observationCoverage: { state: 'RECORDED', complete: true },
  });
  expect(f.tx.pdfConversionInvestigation.findUnique).toHaveBeenCalledTimes(1);
});
it.each([
  'source_sha256',
  'config_sha256',
  'profile_id',
  'worker_fingerprint',
  'job_id',
  'attempt_id',
  'attempt_fence',
  'generation',
  'cancellation_epoch',
  'unit_id',
  'operation_id',
])(
  'does not clear unavailable gaps from a packet with mismatched %s',
  async (key) => {
    const f = fixture((events) => {
      const value = observedPacket(events).binding as Record<string, unknown>;
      value[key] =
        typeof value[key] === 'number'
          ? Number(value[key]) + 1
          : key.includes('sha256') || key === 'worker_fingerprint'
            ? 'e'.repeat(64)
            : key === 'profile_id'
              ? 'ava-pdf-prose-en-v2'
              : 'other';
    });
    const snapshot = await f.snapshot();
    expect(snapshot).toMatchObject({
      evidenceGaps: REPORT_GAPS,
      workerMeasurements: { packetCount: 0, workDurations: 'NOT_OBSERVED' },
    });
  },
);
it('keeps unknown fields/private data out of summary and leaves missing worker evidence explicit', async () => {
  const f = fixture((events) => {
    Object.assign(observedPacket(events), {
      privateText: 'PRIVATE_BOOK_TOKEN_CANARY',
    });
  });
  const snapshot = await f.snapshot();
  expect(snapshot).toMatchObject({
    evidenceGaps: REPORT_GAPS,
    workerMeasurements: { packetCount: 0 },
  });
  expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_BOOK_TOKEN_CANARY');
});
it('a complete delivery stream without a worker packet cannot manufacture measurements', async () => {
  const f = fixture((events) => {
    delete events[1].details.workerObservation;
  });
  const snapshot = await f.snapshot();
  expect(snapshot).toMatchObject({
    evidenceGaps: REPORT_GAPS,
    workerMeasurements: { packetCount: 0 },
    observationCoverage: { state: 'RECORDED', complete: true },
  });
});

it('does not accept a packet from a different claimed attempt envelope', async () => {
  const f = fixture((events) => {
    events[1].attemptId = 'another-attempt';
    events[1].details.observationDelivery = {
      producerId: 'another-attempt',
      ordinal: 1,
    };
    observedPacket(events).binding.attempt_id = 'another-attempt';
  });
  expect(await f.snapshot()).toMatchObject({
    evidenceGaps: REPORT_GAPS,
    workerMeasurements: { packetCount: 0, rejectedPacketCount: 1 },
  });
});
it('keeps partial resources and inventory explicit even when the packet delivery is complete', async () => {
  const f = fixture((events) => {
    const p = observedPacket(events);
    p.resources.scratch_current_bytes = null;
    p.resources.scratch_scan = 'unavailable';
    p.inventory.coverage = 'partial';
  });
  expect(await f.snapshot()).toMatchObject({
    evidenceGaps: [
      'WORKER_TIMING_OUTSIDE_RECORDED_COMMANDS',
      'REUSE_OUTSIDE_RECORDED_WORKER_SCOPE',
      'CPU_RSS_SCRATCH',
      'DETECTED_LANGUAGE_LAYOUT_ANNOTATION_INVENTORY',
    ],
    workerMeasurements: {
      packetCount: 1,
      resources: 'PARTIAL',
      inventory: 'PARTIAL',
    },
    observationCoverage: { state: 'RECORDED', complete: true },
  });
});
it('uses the same retained timeline watermark for Snapshot/Export availability without rewriting the stored gaps', async () => {
  const f = fixture();
  const snapshot = await f.snapshot(),
    exported = await f.exported();
  expect(exported.investigation.workerMeasurements).toEqual(
    snapshot.workerMeasurements,
  );
  expect(exported.investigation.evidenceGaps).toEqual(snapshot.evidenceGaps);
  expect(exported.timeline.watermark).toBe(3);
  expect(exported.timeline.events).toHaveLength(1);
  expect(record.evidenceGaps).toEqual(REPORT_GAPS);
});

it.each([
  'sourceSha256',
  'configSha256',
  'profileId',
  'workerFingerprint',
  'jobId',
  'operationKey',
] as const)(
  'requires the current retained report %s to match the command evidence',
  async (key) => {
    const scope = {
      ...record,
      [key]:
        key.includes('Sha256') || key === 'workerFingerprint'
          ? 'e'.repeat(64)
          : 'other',
    };
    expect(await fixture(() => {}, scope).snapshot()).toMatchObject({
      evidenceGaps: REPORT_GAPS,
      workerMeasurements: { packetCount: 0 },
    });
  },
);

it.each(['missing', 'unobserved', 'malformed'])(
  'keeps mixed valid and %s known command evidence partial rather than clearing absence gaps',
  async (mode) => {
    const f = fixture(
      (events) => {
        const extra = structuredClone(events[1]);
        extra.sequence = 4;
        extra.details.unitId = 'second-command';
        if (mode === 'missing') delete extra.details.workerObservation;
        if (mode === 'unobserved')
          extra.details.workerObservation = {
            status: 'UNOBSERVED',
            reason: 'NOT_EMITTED',
          };
        if (mode === 'malformed')
          Object.assign(observedPacket([events[0], extra]), {
            privateText: 'PRIVATE_MALFORMED_CANARY',
          });
        events.push(extra);
      },
      { ...record, nextSequence: 4 },
    );
    const snapshot = await f.snapshot();
    expect(snapshot).toMatchObject({
      evidenceGaps: REPORT_GAPS,
      workerMeasurements: {
        packetCount: 1,
        missingPacketCount: 1,
        workDurations: 'PARTIAL',
        checkpointReuse: 'PARTIAL',
        resources: 'PARTIAL',
        inventory: 'PARTIAL',
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_MALFORMED_CANARY');
  },
);
it('does not count the same attempt/unit with another request digest as a second measured command', async () => {
  const f = fixture(
    (events) => {
      const extra = structuredClone(events[1]);
      extra.sequence = 4;
      if (extra.details.workerObservation?.status !== 'OBSERVED')
        throw new Error('AUTHORED_FIXTURE_INVALID');
      extra.details.workerObservation.packet.binding.request_sha256 =
        'e'.repeat(64);
      extra.details.observationDelivery = {
        producerId: binding.attempt_id,
        ordinal: 2,
      };
      events.push(extra);
    },
    { ...record, nextSequence: 4 },
  );
  expect(await f.snapshot()).toMatchObject({
    evidenceGaps: REPORT_GAPS,
    workerMeasurements: {
      packetCount: 1,
      rejectedPacketCount: 1,
      workDurations: 'PARTIAL',
    },
  });
});

it('retains completed worker measurements when the host rejects its output, without changing the failed operation', async () => {
  const f = fixture((events) => {
    const completed = observedPacket(events);
    completed.outcome = 'completed';
    completed.failure_code = null;
    for (const phase of completed.phases) phase.outcome = 'completed';
    events[1].details.failureCode = 'INVALID_RESULT';
    const event = Object.fromEntries(
      Object.entries(events[1]).filter(
        ([key]) => key !== 'sequence' && key !== 'createdAt',
      ),
    );
    expect(safeEventSchema.safeParse(event).success).toBe(true);
  });
  const snapshot = await f.snapshot(),
    exported = await f.exported();
  expect(snapshot).toMatchObject({
    status: 'FAILED',
    workerMeasurements: {
      packetCount: 1,
      rejectedPacketCount: 0,
      workDurations: 'AVAILABLE',
      resources: 'AVAILABLE',
      sourceFidelity: 'NOT_ESTABLISHED',
      failureCode: null,
    },
  });
  expect(snapshot.workerMeasurements?.limitations).toContain(
    'WORKER_OUTCOME_DISTINCT_FROM_COORDINATOR_OUTCOME',
  );
  expect(exported.investigation.workerMeasurements).toEqual(
    snapshot.workerMeasurements,
  );
  expect(record.status).toBe('FAILED');
  expect(record.evidenceGaps).toEqual(REPORT_GAPS);
});

it.each([undefined, 'WORKER_CRASH', 'SOURCE_MISMATCH'])(
  'still refuses unproven completed-worker/failed-host mismatch with code %s',
  async (failureCode) => {
    const f = fixture((events) => {
      const completed = observedPacket(events);
      completed.outcome = 'completed';
      completed.failure_code = null;
      for (const phase of completed.phases) phase.outcome = 'completed';
      events[1].details.failureCode = failureCode;
    });
    expect(await f.snapshot()).toMatchObject({
      status: 'FAILED',
      evidenceGaps: REPORT_GAPS,
      workerMeasurements: {
        packetCount: 0,
        rejectedPacketCount: 1,
        workDurations: 'NOT_OBSERVED',
      },
    });
  },
);
