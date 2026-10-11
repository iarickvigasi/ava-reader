import { runChapterPurposeAnalysis } from './chapter-purpose/run-analysis';
import {
  pollerFixture,
  productionPollerTimers,
} from './book-analysis-poller.fixture';

jest.mock('./chapter-purpose/run-analysis', () => ({
  runChapterPurposeAnalysis: jest.fn(),
}));
const analyse = jest.mocked(runChapterPurposeAnalysis);

describe('book analysis scheduled settlement', () => {
  productionPollerTimers();
  beforeEach(() => analyse.mockReset());

  it('claims and settles pending work on a later scheduled tick after a queue rejection', async () => {
    const { service, lookup, claim, update, model, warn } = pollerFixture();
    const run = { bookId: 'recovered-book', id: 'recovered-run' };
    lookup
      .mockRejectedValueOnce(
        Object.assign(new Error('private database URI'), { code: 'P1001' }),
      )
      .mockResolvedValueOnce(run);
    analyse.mockResolvedValueOnce(undefined);
    service.onModuleInit();
    try {
      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(claim).not.toHaveBeenCalled();
      expect(analyse).not.toHaveBeenCalled();
      expect(model).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([
        [
          'Book background analysis unavailable (P1001); checking again on the next poll.',
        ],
      ]);

      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(2);
      expect(claim).toHaveBeenCalledTimes(1);
      expect(claim).toHaveBeenCalledWith({
        where: { id: run.id, status: 'PENDING' },
        data: {
          completedAt: null,
          errorMessage: null,
          status: 'PROCESSING',
        },
      });
      expect(analyse).toHaveBeenCalledTimes(1);
      expect(analyse.mock.calls[0]?.[0].bookId).toBe(run.bookId);
      expect(model).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0]?.[0]).toMatchObject({
        where: { id: run.id },
        data: { status: 'READY', errorMessage: null },
      });
      expect(update.mock.calls[0]?.[0].data.completedAt).toBeInstanceOf(Date);
      expect(warn).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(3);
      expect(claim).toHaveBeenCalledTimes(1);
      expect(analyse).toHaveBeenCalledTimes(1);
      expect(model).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
    } finally {
      service.onModuleDestroy();
    }
  });

  it('contains failure bookkeeping rejection without replaying the provider call', async () => {
    const { service, lookup, claim, update, model, warn } = pollerFixture();
    const analysisError = new Error('private provider URI and book content');
    const storageError = Object.assign(new Error('private database URI'), {
      code: 'P2028',
    });
    lookup.mockResolvedValueOnce({ bookId: 'test-book', id: 'test-run' });
    analyse.mockRejectedValueOnce(analysisError);
    update.mockRejectedValueOnce(storageError);
    service.onModuleInit();
    try {
      await jest.advanceTimersByTimeAsync(2000);
      expect(claim).toHaveBeenCalledTimes(1);
      expect(analyse).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'test-run' },
        data: { status: 'FAILED', errorMessage: analysisError.message },
      });
      expect(warn.mock.calls).toEqual([
        ['Chapter-purpose analysis failed (BACKGROUND_UNAVAILABLE).'],
        [
          'Book background analysis unavailable (P2028); checking again on the next poll.',
        ],
      ]);
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private');
      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(2);
      expect(analyse).toHaveBeenCalledTimes(1);
      expect(model).toHaveBeenCalledTimes(1);
    } finally {
      service.onModuleDestroy();
    }
  });

  it('preserves successful claimed-run settlement and its boolean outcome', async () => {
    const { service, lookup, claim, update, warn } = pollerFixture();
    lookup.mockResolvedValueOnce({ bookId: 'test-book', id: 'test-run' });
    analyse.mockResolvedValueOnce(undefined);
    await expect(service.processPendingRunsOnce()).resolves.toBe(true);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'test-run' },
      data: { status: 'READY', errorMessage: null },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([undefined, 'postgresql://private', 'P1001-private', 'ECONNRESET'])(
    'redacts unknown or malformed code %s',
    async (code) => {
      const { service, lookup, warn } = pollerFixture();
      lookup.mockRejectedValueOnce(
        Object.assign(new Error('private content'), { code }),
      );
      service.onModuleInit();
      try {
        await jest.advanceTimersByTimeAsync(2000);
        expect(warn).toHaveBeenCalledWith(
          'Book background analysis unavailable (BACKGROUND_UNAVAILABLE); checking again on the next poll.',
        );
      } finally {
        service.onModuleDestroy();
      }
    },
  );
});
