import { faultAcknowledgement } from './fault-acknowledgement';

const expected = {
  operation_id: 'operation-one',
  attempt_fence: 7,
  fault: 'memory',
};
describe('fault evidence correlation', () => {
  it('only accepts the armed fault in the exact operation attempt', () => {
    const valid = { ...expected, event: 'fault_ack' as const, at_ms: 1234567 };
    expect(faultAcknowledgement(JSON.stringify(valid), expected)).toEqual(
      valid,
    );
    for (const change of [
      { operation_id: 'other' },
      { attempt_fence: 6 },
      { fault: 'cpu' },
      { at_ms: 0 },
      { event: 'other' },
    ])
      expect(
        faultAcknowledgement(JSON.stringify({ ...valid, ...change }), expected),
      ).toBeUndefined();
    expect(faultAcknowledgement(JSON.stringify(valid))).toBeUndefined();
    expect(
      faultAcknowledgement('{"event":"fault_ack"}', expected),
    ).toBeUndefined();
  });
});
