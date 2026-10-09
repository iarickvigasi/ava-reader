import type { Tx } from '../jobs/types';
import { readObservationCoverage } from './read-observation-coverage';
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
