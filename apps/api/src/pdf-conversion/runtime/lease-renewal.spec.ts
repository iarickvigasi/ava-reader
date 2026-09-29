import { leaseGuard } from './lease-guard';
import { renewalFailure } from './renewal-failure';
const receipt = { leaseRemainingMs: 3000, deadlineRemainingMs: 30000 };
const transient = () =>
  Object.assign(new Error('private connection detail'), { code: 'P2028' });
afterEach(() => jest.useRealTimers());
it('recovers a transient heartbeat without extending authority before confirmation', async () => {
  jest.useFakeTimers();
  const renew = jest
    .fn<Promise<typeof receipt>, []>()
    .mockRejectedValueOnce(transient())
    .mockResolvedValue(receipt);
  const guard = leaseGuard(receipt, 0, renew);
  await jest.advanceTimersByTimeAsync(1000);
  expect(guard.signal.aborted).toBe(false);
  expect(guard.remainingMs()).toBe(2000);
  expect(guard.diagnostic()).toMatchObject({
    renewalFailures: 1,
    lastRenewalCode: 'P2028',
  });
  await jest.advanceTimersByTimeAsync(1000);
  expect(renew).toHaveBeenCalledTimes(2);
  expect(guard.remainingMs()).toBeGreaterThan(2900);
  guard.dispose();
});
it('persistent transient failures cannot postpone the original lease expiry', async () => {
  jest.useFakeTimers();
  const guard = leaseGuard(receipt, 0, () => Promise.reject(transient()));
  await jest.advanceTimersByTimeAsync(2999);
  expect(guard.signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(guard.signal.aborted).toBe(true);
  expect(guard.remainingMs()).toBe(0);
  expect(guard.diagnostic().reason).toBe('lease_expired');
  guard.dispose();
});
it.each(['PDF_JOB_AUTHORITY_INVALID', 'UNRECOGNIZED'])(
  'immediately stops non-transient %s',
  async (code) => {
    jest.useFakeTimers();
    const guard = leaseGuard(receipt, 0, () =>
      Promise.reject(Object.assign(new Error('secret'), { code })),
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect(guard.signal.aborted).toBe(true);
    expect(guard.diagnostic().reason).toBe('renewal_rejected');
    expect(JSON.stringify(guard.diagnostic())).not.toContain('secret');
    guard.dispose();
  },
);
it('operator stop cancels retry timers without another renewal', async () => {
  jest.useFakeTimers();
  const stop = new AbortController(),
    renew = jest.fn(() => Promise.reject(transient()));
  const guard = leaseGuard(receipt, 0, renew, stop.signal);
  await jest.advanceTimersByTimeAsync(1000);
  stop.abort();
  guard.dispose();
  await jest.advanceTimersByTimeAsync(5000);
  expect(renew).toHaveBeenCalledTimes(1);
  expect(guard.diagnostic().reason).toBe('operator_stop');
  guard.dispose();
});
it('never exposes raw unknown database error values', () => {
  expect(
    renewalFailure(
      Object.assign(new Error('private'), { code: 'private secret' }),
    ),
  ).toEqual({ code: 'RENEWAL_FAILED', retry: false });
});
