import type { Prisma } from '@prisma/client';
import { checkpointFixture } from './checkpoint-test-fixture';
import { saveReadingCheckpoint } from './save-checkpoint';
import { validateCheckpoint } from './validate-checkpoint';

it('advances snapshot revision only when checkpoint coverage changes', async () => {
  const { save, tx } = checkpointFixture();
  await save(0, 1);
  await save(5, 2);
  await save(5, 2);
  await save(0, 1);
  await save(5, 3, true);
  const writes = (tx.$executeRaw.mock.calls as Array<[Prisma.Sql]>).filter(
    ([sql]) => sql.strings.join('').startsWith('UPDATE "User"'),
  );
  expect(writes).toHaveLength(3);
  expect(writes.every(([sql]) => sql.values.includes('user'))).toBe(true);
});

it('extends the whole-second prefix across midnight without rerounding its tail', async () => {
  const { prisma, segments } = checkpointFixture();
  const checkpoint = (checkpointAt: string, revision: number) =>
    validateCheckpoint({
      clientSessionId: 'client',
      startedAt: '2026-11-03T23:59:30.700Z',
      checkpointAt,
      endedAt: null,
      timeZone: 'Africa/Cairo',
      revision,
    });
  await saveReadingCheckpoint(
    prisma,
    'user',
    'book',
    checkpoint('2026-11-03T23:59:50.700Z', 1),
  );
  await saveReadingCheckpoint(
    prisma,
    'user',
    'book',
    checkpoint('2026-11-04T00:00:30.700Z', 2),
  );
  expect(Object.fromEntries(segments)).toEqual({
    'client:2026-11-03T00:00:00.000Z': 30,
    'client:2026-11-04T00:00:00.000Z': 30,
  });
});
