import { measurementPacket } from '../../library/pdf-import/reports/worker-measurements-fixture';
import { WORKER_OBSERVATION_PREFIX } from './worker-observation';
import { exchangeInput } from './exchange-test-fixture';
import { workerObserver } from './worker-observer';
import type { workerObservationSink } from './worker-observation-sink';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { SafeConversionEvent } from '../../library/pdf-import/reports/event-contract';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';

export function failureObservationFixture(completed = false) {
  const packet = structuredClone(measurementPacket);
  if (completed) {
    packet.outcome = 'completed';
    packet.failure_code = null;
    for (const phase of packet.phases) phase.outcome = 'completed';
  }
  const input = {
    ...exchangeInput(),
    observationBinding: { ...packet.binding },
    observationCommand: {
      command: packet.command,
      page_number: packet.page_number,
    },
  };
  return {
    packet,
    input,
    line: (value: unknown = packet) =>
      `${WORKER_OBSERVATION_PREFIX}${JSON.stringify(value)}\n`,
  };
}

export function failureObserverFixture() {
  const events: SafeConversionEvent[] = [];
  const claim = {
    jobId: 'job-fixture',
    job: JSON.parse(fixtureBytes('ava-pdf-job-1').toString()) as JobInputV1,
    authority: { attemptId: 'attempt-fixture' },
  } as ClaimedPdfJob;
  const sink = {
    emit: (event: SafeConversionEvent) => events.push(event),
    summary: () => ({ pending: 0, lost: 0, state: 'RECORDED' as const }),
  } as unknown as ReturnType<typeof workerObservationSink>;
  return {
    events,
    claim,
    observer: workerObserver(claim, sink, new AbortController().signal),
  };
}
