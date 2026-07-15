export function evaluatePersistEligibility(input: {
  lastServerAckKey: null | string;
  locatorKey: null | string;
  pendingServerLocatorKey: null | string;
}) {
  if (!input.locatorKey || input.locatorKey === input.lastServerAckKey) {
    return {
      shouldClearPending: input.pendingServerLocatorKey === input.locatorKey,
      shouldPersist: false,
    };
  }

  return {
    shouldClearPending: false,
    shouldPersist: true,
  };
}

export function shouldClearPendingAfterAck(input: {
  ackKey: null | string;
  pendingServerLocatorKey: null | string;
}) {
  return input.pendingServerLocatorKey === input.ackKey;
}

export function shouldFlushPendingProgress(input: {
  lastServerAckKey: null | string;
  pendingLocatorExists: boolean;
  pendingServerLocatorKey: null | string;
}) {
  return Boolean(
    input.pendingLocatorExists &&
      input.pendingServerLocatorKey &&
      input.pendingServerLocatorKey !== input.lastServerAckKey,
  );
}
