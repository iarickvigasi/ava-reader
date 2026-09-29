import { findOrCreateActiveSessionTx } from './find-or-create-active-session';
import { replayCompletedSessionTx } from './replay-completed-session';
import { lockActiveSessionTx } from './lock-session';

jest.mock('./lock-session', () => ({ lockActiveSessionTx: jest.fn() }));
jest.mock('./session-segments', () => ({
  startOfUtcDay: (date: Date) =>
    new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`),
  incrementSessionSegmentsTx: jest.fn(),
}));
jest.mock('./sync-progress-minutes', () => ({
  syncReadingProgressMinutesTx: jest.fn(),
}));

const params = {
  userId: 'reader',
  libraryItemId: 'book',
  clientSessionId: 'client',
  startedAt: new Date('2026-09-24T22:10:00Z'),
  timeZone: 'Europe/Belgrade',
};
const record = { ...params, id: 'session', durationSeconds: 2400 };
beforeEach(() => jest.clearAllMocks());

it('saves the first timezone and preserves it when another device joins the session', async () => {
  jest
    .mocked(lockActiveSessionTx)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(record as never);
  const tx = {
    readingSession: { create: jest.fn().mockResolvedValue(record) },
  };
  await findOrCreateActiveSessionTx(tx as never, {
    ...params,
    replayEnd: null,
  });
  expect(tx.readingSession.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ timeZone: 'Europe/Belgrade' }) as unknown,
    }),
  );
  const joined = await findOrCreateActiveSessionTx(tx as never, {
    ...params,
    replayEnd: null,
    timeZone: 'America/Los_Angeles',
  });
  expect(joined).toBe(record);
  expect(tx.readingSession.create).toHaveBeenCalledTimes(1);
});
it('persists an offline start zone and never rewrites it on replay retry', async () => {
  const tx = {
    readingSession: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(record),
      create: jest.fn().mockResolvedValue(record),
    },
  };
  const replay = {
    ...params,
    durationSeconds: 2400,
    endedAt: new Date('2026-09-24T22:50:00Z'),
  };
  await replayCompletedSessionTx(tx as never, replay);
  expect(tx.readingSession.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ timeZone: 'Europe/Belgrade' }) as unknown,
    }),
  );
  expect(
    await replayCompletedSessionTx(tx as never, {
      ...replay,
      timeZone: 'America/Los_Angeles',
    }),
  ).toBe(record);
  expect(tx.readingSession.create).toHaveBeenCalledTimes(1);
});
