import { checkpointFixture } from './checkpoint-test-fixture';

it('adds independent overlapping device time and only each checkpoint extension', async () => {
  const { save, segments, tx } = checkpointFixture();
  await save(10, 1, false, 'online-device');
  await save(5, 1, false, 'offline-device');
  await save(8, 2, true, 'offline-device');
  expect([...segments.values()].reduce((a, b) => a + b, 0)).toBe(18 * 60);
  expect(tx.readingProgress.updateMany).toHaveBeenLastCalledWith({
    where: { userId: 'user', libraryItemId: 'book' },
    data: { minutesRead: 18 },
  });
  expect(tx.readingSessionInterval.create).toHaveBeenLastCalledWith({
    data: {
      readingSessionId: 'offline-device',
      startedAt: new Date('2026-11-03T10:05:00Z'),
      endedAt: new Date('2026-11-03T10:08:00Z'),
    },
  });
});

it('survives lost responses, duplicate uploads and reversed revisions', async () => {
  const { save, segments, tx } = checkpointFixture();
  const accepted = await save(8, 3, true);
  expect(await save(8, 3, true)).toEqual(accepted);
  expect(await save(5, 2)).toEqual(accepted);
  expect(await save(0, 1)).toEqual(accepted);
  expect([...segments.values()]).toEqual([480]);
  expect(tx.readingSession.update).toHaveBeenCalledTimes(1);
});

it('acknowledges a final zero-extension checkpoint without crediting again', async () => {
  const { save, sessions, segments } = checkpointFixture();
  await save(5, 2);
  expect(await save(5, 3, true)).toEqual({
    sessionId: 'client',
    revision: 3,
    durationSeconds: 300,
  });
  expect(sessions.get('client')?.endedAt).toEqual(
    new Date('2026-11-03T10:05:00Z'),
  );
  expect([...segments.values()]).toEqual([300]);
});

it('rejects shortening, extending or reopening a finalized session', async () => {
  const { save, segments } = checkpointFixture();
  await save(5, 2);
  await expect(save(4, 3)).rejects.toThrow('cannot shorten');
  await save(5, 4, true);
  await expect(save(6, 5, true)).rejects.toThrow('cannot reopen or extend');
  await expect(save(5, 6)).rejects.toThrow('cannot reopen or extend');
  expect([...segments.values()]).toEqual([300]);
});
