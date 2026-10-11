import {
  pollerFixture,
  productionPollerTimers,
} from './book-analysis-poller.fixture';

describe('book analysis poller lifecycle', () => {
  productionPollerTimers();

  it('prevents overlapping claims, releases the latch after rejection, then recovers', async () => {
    const { service, lookup, warn } = pollerFixture();
    let reject!: (error: unknown) => void;
    lookup.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    service.onModuleInit();
    try {
      await jest.advanceTimersByTimeAsync(4000);
      expect(lookup).toHaveBeenCalledTimes(1);
      reject(Object.assign(new Error('private URI'), { code: 'P1001' }));
      await jest.advanceTimersByTimeAsync(0);
      expect(warn).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(2);
    } finally {
      service.onModuleDestroy();
    }
  });

  it('clears future scheduling on shutdown but contains an already-running rejection', async () => {
    const { service, lookup, warn } = pollerFixture();
    let reject!: (error: unknown) => void;
    lookup.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(2000);
    service.onModuleDestroy();
    service.onModuleDestroy();
    reject(new Error('private shutdown exception'));
    await jest.advanceTimersByTimeAsync(10000);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Book background analysis unavailable (BACKGROUND_UNAVAILABLE); checking again on the next poll.',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains observed rejection for direct callers and releases their latch', async () => {
    const { service, lookup, warn } = pollerFixture();
    const error = new Error('direct caller failure');
    lookup.mockRejectedValueOnce(error);
    await expect(service.processPendingRunsOnce()).rejects.toBe(error);
    await expect(service.processPendingRunsOnce()).resolves.toBe(false);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not create a poller in test mode', async () => {
    process.env.NODE_ENV = 'test';
    const { service, lookup } = pollerFixture();
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(10000);
    expect(lookup).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    service.onModuleDestroy();
  });
});
