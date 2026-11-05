import { checkpointFixture, makeCheckpoint } from './checkpoint-test-fixture';
import { saveReadingCheckpoint } from './save-checkpoint';

it('keeps the original book, start and zone immutable', async () => {
  const { save, prisma, segments } = checkpointFixture();
  await save(5, 1);
  const checkpoint = makeCheckpoint(8, 2);
  await expect(
    saveReadingCheckpoint(prisma, 'user', 'other-book', checkpoint),
  ).rejects.toThrow('original session');
  await expect(
    saveReadingCheckpoint(prisma, 'user', 'book', {
      ...checkpoint,
      timeZone: 'Europe/Belgrade',
    }),
  ).rejects.toThrow('original session');
  await expect(
    saveReadingCheckpoint(prisma, 'user', 'book', {
      ...checkpoint,
      startedAt: new Date('2026-11-03T09:00:00Z'),
    }),
  ).rejects.toThrow('original session');
  expect([...segments.values()]).toEqual([300]);
});

it('does not reinterpret existing legacy credited time as a checkpoint session', async () => {
  const { save, sessions, segments } = checkpointFixture();
  await save(5, 1);
  sessions.get('client')!.trackingVersion = 1;
  await expect(save(8, 2)).rejects.toThrow('original session');
  expect([...segments.values()]).toEqual([300]);
});

it('retains completed offline time for an owned deleted book', async () => {
  const { save, tx, segments } = checkpointFixture();
  await save(2, 1);
  tx.libraryItem.findFirst.mockResolvedValue(null);
  tx.deletedLibraryItem.findFirst.mockResolvedValue({ id: 'book' });
  await expect(save(5, 2)).rejects.toThrow('not found');
  await save(5, 3, true);
  expect([...segments.values()]).toEqual([300]);
  expect(tx.deletedLibraryItem.findFirst).toHaveBeenCalledWith({
    where: { id: 'book', userId: 'user' },
  });
});

it('rejects unowned or nonexistent books even for completed runs', async () => {
  const { save, tx } = checkpointFixture();
  tx.libraryItem.findFirst.mockResolvedValue(null);
  await expect(save(5, 1, true)).rejects.toThrow('not found');
  expect(tx.readingSession.create).not.toHaveBeenCalled();
});
