export type FaultExpectation = {
  fault: string;
  operation_id: string;
  attempt_fence: number;
};
export type FaultAcknowledgement = FaultExpectation & {
  event: 'fault_ack';
  at_ms: number;
};

export function faultAcknowledgement(
  stderr: string,
  expected?: FaultExpectation,
): FaultAcknowledgement | undefined {
  if (!expected) return undefined;
  for (const line of stderr.split('\n')) {
    try {
      const value = JSON.parse(line) as FaultAcknowledgement;
      if (
        value.event === 'fault_ack' &&
        value.fault === expected.fault &&
        value.operation_id === expected.operation_id &&
        value.attempt_fence === expected.attempt_fence &&
        Number.isSafeInteger(value.at_ms) &&
        value.at_ms > 0
      )
        return {
          event: 'fault_ack',
          ...expected,
          at_ms: value.at_ms,
        };
    } catch {
      /* Stderr is never forwarded as evidence or a public reason. */
    }
  }
  return undefined;
}
