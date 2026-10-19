import {
  safeObservationWatermark,
  readObservationWatermark,
  observationWatermarkDetails,
} from './observation-contract';
const snapshot = {
  version: 1,
  producerId: 'attempt',
  throughOrdinal: 3,
  reportedFailures: 1,
  sealed: false,
  scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
};
it.each([
  undefined,
  null,
  { ...snapshot, producerId: 'wrong' },
  { ...snapshot, throughOrdinal: -1 },
  { ...snapshot, prompt: 'PRIVATE_PROMPT' },
  {
    get version() {
      throw new Error('PRIVATE_FAILURE');
    },
  },
])('invalid optional capture remains unavailable without throwing', (value) => {
  expect(safeObservationWatermark(value, 'attempt')).toBeUndefined();
});
it('contains hostile optional accessors before lifecycle work', () => {
  expect(
    readObservationWatermark(
      {
        get observationWatermark() {
          throw new Error('PRIVATE_FAILURE');
        },
      },
      'attempt',
    ),
  ).toBeUndefined();
});
it('snapshots caller data and does not label a durable prefix as a final seal', () => {
  const value = { ...snapshot };
  const captured = safeObservationWatermark(value, 'attempt');
  value.throughOrdinal = 99;
  expect(captured?.throughOrdinal).toBe(3);
  expect(
    observationWatermarkDetails(
      { ...snapshot, sealed: true },
      'attempt',
      () => {
        throw new Error();
      },
    ),
  ).toEqual({});
});
