import { renewalFailure } from './renewal-failure';
export { underLease } from './under-lease';
export type LeaseReceipt = {
  leaseRemainingMs: number;
  deadlineRemainingMs: number;
};
export function leaseGuard(
  initial: LeaseReceipt,
  initialRoundTripMs: number,
  renew: () => Promise<LeaseReceipt>,
  parent?: AbortSignal,
) {
  const abort = new AbortController();
  let deadline = 0,
    disposed = false,
    renewalFailures = 0;
  let reason: string | undefined, lastRenewalCode: string | undefined;
  let expiry: ReturnType<typeof setTimeout>,
    renewal: ReturnType<typeof setTimeout>;
  const remainingMs = () => Math.max(0, deadline - performance.now());
  const stop = (cause: string) => {
    reason ??= cause;
    abort.abort();
  };
  const parentStop = () => stop('operator_stop');
  const schedule = (delay: number) => {
    clearTimeout(renewal);
    renewal = setTimeout(() => {
      if (disposed || abort.signal.aborted) return;
      const started = performance.now();
      void Promise.resolve()
        .then(renew)
        .then((next) => install(next, performance.now() - started))
        .catch((error: unknown) => {
          if (disposed || abort.signal.aborted) return;
          const failure = renewalFailure(error);
          renewalFailures++;
          lastRenewalCode = failure.code;
          if (failure.retry && remainingMs() > 0) schedule(1000);
          else stop('renewal_rejected');
        });
    }, delay);
  };
  const install = (
    receipt: LeaseReceipt,
    roundTripMs: number,
    first = false,
  ) => {
    if (disposed || abort.signal.aborted) return;
    if (!first && remainingMs() <= 0) {
      stop('lease_expired');
      return;
    }
    const ttl =
      Math.min(30000, receipt.leaseRemainingMs, receipt.deadlineRemainingMs) -
      roundTripMs;
    if (!Number.isFinite(ttl) || ttl <= 0) {
      stop('invalid_or_expired_receipt');
      return;
    }
    deadline = performance.now() + ttl;
    clearTimeout(expiry);
    expiry = setTimeout(() => stop('lease_expired'), ttl);
    schedule(Math.max(10, Math.min(10000, ttl / 3)));
  };
  parent?.addEventListener('abort', parentStop, { once: true });
  install(initial, initialRoundTripMs, true);
  if (parent?.aborted) parentStop();
  return {
    signal: abort.signal,
    remainingMs,
    diagnostic: () => ({ reason, renewalFailures, lastRenewalCode }),
    confirm: (receipt: LeaseReceipt, roundTripMs: number) =>
      install(receipt, roundTripMs),
    dispose() {
      disposed = true;
      clearTimeout(expiry);
      clearTimeout(renewal);
      parent?.removeEventListener('abort', parentStop);
    },
  };
}
