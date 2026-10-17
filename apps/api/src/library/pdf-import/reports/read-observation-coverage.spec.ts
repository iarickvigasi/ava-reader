import type { Tx } from '../jobs/types';
import { readObservationCoverage } from './read-observation-coverage';
import { measurementPacket } from './worker-measurements-fixture';
import { measurementEvidenceGaps } from './worker-measurements';
import { REPORT_GAPS } from './record';
jest.mock('./observation-coverage', () => ({
  ...jest.requireActual<typeof import('./observation-coverage')>(
    './observation-coverage',
  ),
  MAX_OBSERVATION_ROWS: 2,
}));
const identity = {
  attemptId: 'attempt',
  attemptFence: 1,
  generation: 1,
  cancellationEpoch: 0,
};
const details = {
  jobId: 'job',
  sourceSha256: 'a'.repeat(64),
  configSha256: 'b'.repeat(64),
  profileId: 'ava-pdf-prose-en-v2',
  workerFingerprint: 'c'.repeat(64),
};
const row = (sequence: number, sealed = false) => ({
  sequence,
  ...identity,
  kind: sealed ? 'VALIDATION' : 'CLAIMED',
  stage: sealed ? 'VALIDATION' : 'PREFLIGHT',
  severity: 'INFO',
  details: {
    ...details,
    ...(sealed
      ? {
          outcome: 'UNOBSERVED',
          observationWatermark: {
            version: 1,
            producerId: 'attempt',
            throughOrdinal: 0,
            reportedFailures: 0,
            sealed: true,
            scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
          },
        }
      : {
          observationProtocol: {
            version: 1,
            producerId: 'attempt',
            scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
          },
        }),
  },
});
it('scan truncation cannot promote a visible seal into complete coverage', async () => {
  const findMany = jest.fn().mockResolvedValue([row(1), row(2, true)]);
  const findFirst = jest.fn().mockResolvedValue({ sequence: 3 });
  const tx = { pdfConversionEvent: { findMany, findFirst } } as unknown as Tx;
  expect(await readObservationCoverage(tx, 'conversion', 3)).toMatchObject({
    state: 'BOUNDED_SCAN_INCOMPLETE',
    complete: false,
    watermark: 3,
  });
  expect(findFirst).toHaveBeenCalled();
  expect(findMany).toHaveBeenCalledWith({
    where: { conversionId: 'conversion', sequence: { gt: 0, lte: 3 } },
    take: 2,
    orderBy: { sequence: 'asc' },
  });
});
it('a complete bounded scan needs no live operation or cost projection', async () => {
  const tx = {
    pdfConversionEvent: {
      findMany: jest.fn().mockResolvedValue([row(1), row(2, true)]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as unknown as Tx;
  expect(await readObservationCoverage(tx, 'conversion', 2)).toMatchObject({
    state: 'RECORDED',
    complete: true,
  });
});
it('private or corrupt event JSON never reaches projected output', async () => {
  const canary = 'PRIVATE_SOURCE_CREDENTIAL_CANARY';
  const tx = {
    pdfConversionEvent: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ ...row(1), details: { prompt: canary } }]),
      findFirst: jest.fn(),
    },
  } as unknown as Tx;
  const result = await readObservationCoverage(tx, 'conversion', 1);
  expect(result.state).toBe('INCONSISTENT');
  expect(JSON.stringify(result)).not.toContain(canary);
});

it('does not clear unavailable gaps from one measured command when the bounded scan is incomplete', async () => {
  const packet = structuredClone(measurementPacket);
  Object.assign(packet.binding, {
    operation_id: 'conversion',
    job_id: details.jobId,
    attempt_id: identity.attemptId,
    unit_id: 'unit-measured',
    source_sha256: details.sourceSha256,
    config_sha256: details.configSha256,
    profile_id: details.profileId,
    worker_fingerprint: details.workerFingerprint,
    attempt_fence: identity.attemptFence,
  });
  packet.inventory.observed_profile_id = packet.binding.profile_id;
  const observed = {
    ...row(2),
    kind: 'STAGE_ENDED',
    stage: 'WORKER_COMMAND',
    details: {
      ...details,
      unitId: packet.binding.unit_id,
      outcome: 'FAILED',
      observationDelivery: { producerId: identity.attemptId, ordinal: 1 },
      workerObservation: { status: 'OBSERVED', packet },
    },
  };
  const tx = {
    pdfConversionEvent: {
      findMany: jest.fn().mockResolvedValue([row(1), observed]),
      findFirst: jest.fn().mockResolvedValue({ sequence: 3 }),
    },
  } as unknown as Tx;
  const result = await readObservationCoverage(tx, 'conversion', 3, {
    operationKey: 'conversion',
    ...details,
  });
  expect(result).toMatchObject({
    state: 'BOUNDED_SCAN_INCOMPLETE',
    workerMeasurements: {
      packetCount: 1,
      scanComplete: false,
      workDurations: 'PARTIAL',
      resources: 'PARTIAL',
    },
  });
  expect(
    measurementEvidenceGaps(REPORT_GAPS, result.workerMeasurements),
  ).toEqual(REPORT_GAPS);
});
