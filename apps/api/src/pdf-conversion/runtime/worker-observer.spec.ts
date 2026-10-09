import { workerObserver } from './worker-observer';
import type { workerObservationSink } from './worker-observation-sink';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { SafeConversionEvent } from '../../library/pdf-import/reports/event-contract';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import { PdfRuntimeError } from './runtime-error';

const claim = {
  jobId: 'job-fixture',
  job: JSON.parse(fixtureBytes('ava-pdf-job-1').toString()) as JobInputV1,
  authority: {
    principalId: 'principal-fixture',
    token: 'private-key',
    attemptId: 'attempt-fixture',
    attemptToken: 'private-token',
  },
} as ClaimedPdfJob;
function setup() {
  const events: SafeConversionEvent[] = [];
  const sink = {
    emit: (event: SafeConversionEvent) => events.push(event),
    summary: () => ({ pending: 0, lost: 0, state: 'RECORDED' as const }),
  } as unknown as ReturnType<typeof workerObservationSink>;
  const controller = new AbortController();
  return {
    events,
    controller,
    observer: workerObserver(claim, sink, controller.signal),
    sink,
  };
}
it('records actual bounded wall work with immutable provenance and no credential fields', async () => {
  const { observer, events } = setup();
  await expect(
    observer.track('EXTRACTION', 'unit-example', () => Promise.resolve(42)),
  ).resolves.toBe(42);
  expect(events.map((event) => event.kind)).toEqual([
    'STAGE_STARTED',
    'STAGE_ENDED',
  ]);
  expect(events[1]).toMatchObject({
    durationKind: 'OBSERVED_WALL_CLOCK',
    details: {
      outcome: 'COMPLETED',
      timingScope: 'COORDINATOR_UNIT_INCLUSIVE_WALL_NOT_SUMMABLE',
      sourceSha256: claim.job.source.sha256,
      jobId: claim.jobId,
    },
  });
  expect(events[1].durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(events)).not.toMatch(
    /private-key|private-token|owner-fixture/,
  );
});
it('failed and aborted units preserve their original failures and do not persist arbitrary messages', async () => {
  const { observer, events, controller } = setup();
  const error = new PdfRuntimeError('RESOURCE_LIMIT');
  await expect(
    observer.track('WORKER_COMMAND', 'unit-failed', () =>
      Promise.reject(error),
    ),
  ).rejects.toBe(error);
  expect(events.at(-1)).toMatchObject({
    details: {
      outcome: 'FAILED',
      failureCode: 'RESOURCE_LIMIT',
      workerObservation: { status: 'UNOBSERVED' },
    },
  });
  controller.abort();
  const privateError = new Error(
    'private source /tmp/private.pdf bearer sk-secret',
  );
  await expect(
    observer.track('WORKER_COMMAND', 'unit-aborted', () =>
      Promise.reject(privateError),
    ),
  ).rejects.toBe(privateError);
  expect(events.at(-1)?.details.outcome).toBe('ABORTED');
  expect(JSON.stringify(events)).not.toContain(privateError.message);
});
it('observation sink/description failures cannot replace a successful conversion result', async () => {
  const { observer, sink } = setup();
  sink.emit = () => {
    throw new Error('unavailable');
  };
  await expect(
    observer.track(
      'ASSEMBLY',
      'unit-sink-failed',
      () => Promise.resolve('candidate'),
      {},
      () => {
        throw new Error('private metric');
      },
    ),
  ).resolves.toBe('candidate');
});
it('a failed optional clock sample preserves work and records an unknown duration', async () => {
  const { observer, events } = setup();
  const clock = jest.spyOn(performance, 'now').mockImplementationOnce(() => {
    throw new Error('clock unavailable');
  });
  try {
    await expect(
      observer.track('EXTRACTION', 'unit-clock-failed', () =>
        Promise.resolve('unchanged'),
      ),
    ).resolves.toBe('unchanged');
  } finally {
    clock.mockRestore();
  }
  expect(events.at(-1)).toMatchObject({
    details: { timingStatus: 'UNOBSERVED' },
  });
  expect(events.at(-1)?.durationMs).toBeUndefined();
});
