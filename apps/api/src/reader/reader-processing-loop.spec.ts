import { ReaderProcessingLoop } from './reader-processing-loop';

describe('reader background infrastructure backoff', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('contains failure, redacts details, bounds retries and resets after success', async () => {
    const loop = new ReaderProcessingLoop(),
      report = jest.fn();
    const error = Object.assign(new Error('private database URI'), {
      code: 'P2028',
    });
    const tick = jest.fn<Promise<boolean>, []>().mockRejectedValue(error);
    for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
      await expect(loop.run(tick, report)).resolves.toBe(false);
      expect(report).toHaveBeenLastCalledWith('P2028', delay);
      const calls = tick.mock.calls.length;
      jest.advanceTimersByTime(delay - 1);
      await loop.run(tick, report);
      expect(tick).toHaveBeenCalledTimes(calls);
      jest.advanceTimersByTime(1);
    }
    tick.mockResolvedValueOnce(true);
    await expect(loop.run(tick, report)).resolves.toBe(true);
    await loop.run(tick, report);
    expect(report).toHaveBeenLastCalledWith('P2028', 2000);
    expect(JSON.stringify(report.mock.calls)).not.toContain(
      'private database URI',
    );
  });
  it('does not overlap work, and an unknown error exposes only a fixed code', async () => {
    const loop = new ReaderProcessingLoop(),
      report = jest.fn();
    let finish!: (value: boolean) => void;
    const tick = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = loop.run(tick, report);
    await expect(loop.run(tick, report)).resolves.toBe(false);
    expect(tick).toHaveBeenCalledTimes(1);
    finish(false);
    await pending;
    await loop.run(() => Promise.reject(new Error('private error')), report);
    expect(report).toHaveBeenCalledWith('BACKGROUND_UNAVAILABLE', 2000);
  });
});
