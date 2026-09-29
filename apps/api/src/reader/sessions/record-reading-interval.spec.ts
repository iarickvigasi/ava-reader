import { recordReadingInterval } from './record-reading-interval';

it('merges adjacent credited activity but retains idle gaps', async () => {
  const rows: Array<{ id: string; startedAt: Date; endedAt: Date }> = [];
  const tx = {
    readingSessionInterval: {
      findFirst: jest.fn(({ where }: { where: { endedAt: Date } }) =>
        rows.find((row) => +row.endedAt === +where.endedAt),
      ),
      create: jest.fn(
        ({ data }: { data: { startedAt: Date; endedAt: Date } }) => {
          rows.push({ id: String(rows.length), ...data });
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { endedAt: Date };
        }) => {
          Object.assign(rows.find((row) => row.id === where.id)!, data);
        },
      ),
    },
  };
  const start = Date.parse('2026-09-24T22:10:00Z');
  for (const offset of [0, 30, 120]) {
    await recordReadingInterval(
      tx as never,
      'session',
      new Date(start + offset * 1000),
      30,
    );
  }
  expect(
    rows.map((row) => [+row.startedAt - start, +row.endedAt - start]),
  ).toEqual([
    [0, 60000],
    [120000, 150000],
  ]);
  await recordReadingInterval(tx as never, 'session', new Date(start), 0);
  expect(rows).toHaveLength(2);
});
