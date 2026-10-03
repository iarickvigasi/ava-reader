import { leaseGuard, underLease } from './lease-guard';

describe('confirmed DB lease watchdog', () => {
  it('does not invoke work after an already-observed authority loss', async () => {
    const stop = new AbortController();
    stop.abort();
    const work = jest.fn(() => Promise.resolve('not allowed'));
    await expect(underLease(work, stop.signal)).rejects.toThrow(
      'DISPATCH_NOT_AUTHORIZED',
    );
    expect(work).not.toHaveBeenCalled();
  });
  afterEach(() => jest.useRealTimers());
  it('expires while a heartbeat is hung and never renews on its pending request', async () => {
    jest.useFakeTimers();
    const renewal = jest.fn(() => new Promise<never>(() => undefined));
    const guard = leaseGuard(
      { leaseRemainingMs: 1000, deadlineRemainingMs: 5000 },
      100,
      renewal,
    );
    await jest.advanceTimersByTimeAsync(301);
    expect(renewal).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(600);
    expect(guard.signal.aborted).toBe(true);
    await expect(
      underLease(() => new Promise(() => undefined), guard.signal),
    ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
    guard.dispose();
  });
  it('subtracts query round-trip time and refuses late responses after expiry', async () => {
    jest.useFakeTimers();
    let resolve: (value: {
      leaseRemainingMs: number;
      deadlineRemainingMs: number;
    }) => void = () => undefined;
    const renewal = () =>
      new Promise<{ leaseRemainingMs: number; deadlineRemainingMs: number }>(
        (done) => {
          resolve = done;
        },
      );
    const guard = leaseGuard(
      { leaseRemainingMs: 1000, deadlineRemainingMs: 5000 },
      100,
      renewal,
    );
    expect(guard.remainingMs()).toBe(900);
    await jest.advanceTimersByTimeAsync(901);
    resolve({ leaseRemainingMs: 1000, deadlineRemainingMs: 5000 });
    await Promise.resolve();
    expect(guard.signal.aborted).toBe(true);
    expect(guard.remainingMs()).toBe(0);
    guard.dispose();
  });
  it('propagates operator stop and rejects unknown or exhausted lease durations', () => {
    const stop = new AbortController();
    const guard = leaseGuard(
      { leaseRemainingMs: 1000, deadlineRemainingMs: 5000 },
      0,
      () => Promise.reject(new Error('unavailable')),
      stop.signal,
    );
    stop.abort();
    expect(guard.signal.aborted).toBe(true);
    guard.dispose();
    for (const ttl of [NaN, 0, -1]) {
      const invalid = leaseGuard(
        { leaseRemainingMs: ttl, deadlineRemainingMs: 5000 },
        0,
        () => Promise.reject(new Error('unavailable')),
      );
      expect(invalid.signal.aborted).toBe(true);
      invalid.dispose();
    }
  });
});
