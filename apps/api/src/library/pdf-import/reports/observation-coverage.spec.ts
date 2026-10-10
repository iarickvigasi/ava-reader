import { projectObservationCoverage } from './observation-coverage';
import type { SafeConversionEvent } from './event-contract';

const identity = {
  attemptId: 'attempt-one',
  attemptFence: 1,
  generation: 1,
  cancellationEpoch: 0,
};
const details = {
  sourceSha256: 'a'.repeat(64),
  configSha256: 'b'.repeat(64),
  profileId: 'ava-pdf-prose-en-v2',
  workerFingerprint: 'c'.repeat(64),
  jobId: 'job-one',
};
const protocol = {
  version: 1 as const,
  producerId: identity.attemptId,
  scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY' as const,
};
const claim = {
  ...identity,
  kind: 'CLAIMED',
  stage: 'PREFLIGHT',
  severity: 'INFO',
  details: { ...details, observationProtocol: protocol },
} as SafeConversionEvent;
function delivery(ordinal: number): SafeConversionEvent {
  return {
    ...identity,
    kind: 'STAGE_ENDED',
    stage: 'WORKER_COMMAND',
    severity: 'INFO',
    details: {
      ...details,
      observationDelivery: { producerId: identity.attemptId, ordinal },
    },
  };
}
function seal(throughOrdinal: number): SafeConversionEvent {
  return {
    ...identity,
    kind: 'VALIDATION',
    stage: 'VALIDATION',
    severity: 'INFO',
    details: {
      ...details,
      observationWatermark: {
        ...protocol,
        throughOrdinal,
        reportedFailures: 0,
        sealed: true,
      },
    },
  };
}
const rows = (...events: SafeConversionEvent[]) =>
  events.map((event, index) => ({ sequence: index + 1, event }));

it('a recreated report detects a killed producer even before its first observation', () => {
  expect(projectObservationCoverage(rows(claim), 1)).toMatchObject({
    state: 'UNSEALED',
    complete: false,
    producers: [{ exactFinalCountKnown: false, recordedOrdinalCount: 0 }],
  });
});
it('a sealed contiguous producer proves only its declared pre-settlement event-delivery scope', () => {
  expect(
    projectObservationCoverage(
      rows(claim, delivery(1), delivery(2), seal(2)),
      4,
    ),
  ).toMatchObject({
    state: 'RECORDED',
    complete: true,
    scope: protocol.scope,
    producers: [{ exactFinalCountKnown: true, expectedThroughOrdinal: 2 }],
  });
});
it('an explicit closed zero-intent producer differs from unavailable history', () => {
  expect(projectObservationCoverage(rows(claim, seal(0)), 2)).toMatchObject({
    state: 'RECORDED',
    producers: [{ exactFinalCountKnown: true, expectedThroughOrdinal: 0 }],
  });
});
it('a retained settlement seal identifies missing observations without live counters', () => {
  expect(
    projectObservationCoverage(
      rows(claim, delivery(1), delivery(4), seal(4)),
      4,
    ),
  ).toMatchObject({
    state: 'PARTIAL',
    complete: false,
    producers: [
      { missingOrdinalCount: 2, missingRanges: [{ first: 2, last: 3 }] },
    ],
  });
});
it('loss of the seal stays unsealed and does not invent an exact final count', () => {
  expect(projectObservationCoverage(rows(claim, delivery(1)), 2)).toMatchObject(
    {
      state: 'UNSEALED',
      complete: false,
      producers: [
        { exactFinalCountKnown: false, expectedThroughOrdinal: null },
      ],
    },
  );
});
it('retained ordinals expose interrupted known-prefix gaps without inventing the final count', () => {
  expect(projectObservationCoverage(rows(claim, delivery(2)), 2)).toMatchObject(
    {
      state: 'UNSEALED',
      producers: [
        {
          exactFinalCountKnown: false,
          knownPrefixThroughOrdinal: 2,
          missingOrdinalCount: 1,
        },
      ],
    },
  );
});
it('capture cannot precede its durable expected-producer declaration', () => {
  expect(
    projectObservationCoverage(rows(delivery(1), claim, seal(1)), 3).state,
  ).toBe('INCONSISTENT');
});
it('conflicting later rows cannot be hidden by an earlier seal', () => {
  expect(
    projectObservationCoverage(
      rows(claim, delivery(1), seal(1), delivery(2)),
      4,
    ).state,
  ).toBe('INCONSISTENT');
});
it('reported delivery failure is distinct from a proven missing journal record', () => {
  const end = seal(1);
  end.details.observationWatermark!.reportedFailures = 1;
  expect(
    projectObservationCoverage(rows(claim, delivery(1), end), 3),
  ).toMatchObject({
    state: 'RECORDED',
    producers: [
      { reportedDeliveryFailuresAtLatestSnapshot: 1, missingOrdinalCount: 0 },
    ],
  });
});
it('ignores rows beyond a fixed watermark and allows late delivery to repair a newer view', () => {
  const events = rows(claim, delivery(2), seal(2), delivery(1));
  expect(projectObservationCoverage(events, 3).state).toBe('PARTIAL');
  expect(projectObservationCoverage(events, 4).state).toBe('RECORDED');
});
it.each([
  { ...delivery(1), generation: 2 },
  {
    ...delivery(1),
    details: { ...delivery(1).details, sourceSha256: 'd'.repeat(64) },
  },
])('rejects inconsistent delivery bindings', (bad) => {
  expect(projectObservationCoverage(rows(claim, bad), 2).state).toBe(
    'INCONSISTENT',
  );
});
it('historical absence of protocol is unavailable rather than zero-loss success', () => {
  expect(projectObservationCoverage([], 0)).toMatchObject({
    state: 'HISTORY_UNAVAILABLE',
    complete: false,
  });
});
it('generic command/heartbeat events cannot pretend to be an authenticated settlement seal', () => {
  const fake = {
    ...seal(0),
    kind: 'STAGE_ENDED' as const,
    stage: 'WORKER_COMMAND',
  };
  expect(projectObservationCoverage(rows(claim, fake), 2).state).toBe(
    'INCONSISTENT',
  );
});
it('one sealed producer cannot hide another unsealed producer', () => {
  const other = {
    ...claim,
    attemptId: 'attempt-two',
    attemptFence: 2,
    details: {
      ...claim.details,
      observationProtocol: { ...protocol, producerId: 'attempt-two' },
    },
  };
  expect(
    projectObservationCoverage(rows(claim, delivery(1), seal(1), other), 4),
  ).toMatchObject({
    state: 'UNSEALED',
    complete: false,
    producers: [
      { producerId: 'attempt-one', state: 'RECORDED' },
      { producerId: 'attempt-two', state: 'UNSEALED' },
    ],
  });
});
it('new complete capture never hides unavailable capture for an older claimed attempt', () => {
  const older = {
    ...claim,
    attemptId: 'older-attempt',
    attemptFence: 0,
    details: { jobId: 'job-one' },
  };
  expect(
    projectObservationCoverage(rows(older, claim, delivery(1), seal(1)), 4),
  ).toMatchObject({
    state: 'HISTORY_UNAVAILABLE',
    complete: false,
    producers: [{ state: 'RECORDED' }],
    historicalProducers: [
      { producerId: 'older-attempt', exactFinalCountKnown: false },
    ],
  });
});
