import { BadRequestException, NotFoundException } from '@nestjs/common';
import { setFinishedAt } from './set-finished-at';

const timestamp = '2026-09-13T10:15:00.000Z';

function fixture() {
  const item = {
    id: 'item-1',
    userId: 'user-1',
    isArchived: false,
    finishedAt: null as Date | null,
    lastOpenedAt: new Date('2026-09-12T20:00:00.000Z'),
  };
  const matches = (where: {
    id: string;
    userId: string;
    isArchived: boolean;
  }) =>
    item.id === where.id &&
    item.userId === where.userId &&
    item.isArchived === where.isArchived;
  const findFirst = jest.fn(
    ({ where }: { where: Parameters<typeof matches>[0] }) =>
      Promise.resolve(matches(where) ? { id: item.id } : null),
  );
  const update = jest.fn(
    ({
      where,
      data,
    }: {
      where: Parameters<typeof matches>[0];
      data: { finishedAt: Date | null };
    }) => {
      if (!matches(where)) throw new Error('No matching owned item');
      Object.assign(item, data);
      return Promise.resolve({ id: item.id, finishedAt: item.finishedAt });
    },
  );
  const updateProgress = jest.fn();
  const options = {
    input: { finishedAt: timestamp } as unknown,
    libraryItemId: item.id,
    prisma: {
      libraryItem: { findFirst, update },
      readingProgress: { update: updateProgress },
    } as never,
    userId: item.userId,
  };
  return { item, options, findFirst, update, updateProgress };
}

describe('set finish date', () => {
  it('records the supplied finish date without updating reading activity', async () => {
    const { item, options, update, updateProgress } = fixture();
    const original = { ...item };

    expect(await setFinishedAt(options)).toEqual({
      libraryItemId: item.id,
      finishedAt: timestamp,
    });
    expect(item).toEqual({ ...original, finishedAt: new Date(timestamp) });
    expect(update.mock.calls[0][0].data).toEqual({
      finishedAt: new Date(timestamp),
    });
    expect(updateProgress).not.toHaveBeenCalled();
  });

  it('clears the finish date without updating reading activity', async () => {
    const { item, options, update, updateProgress } = fixture();
    item.finishedAt = new Date(timestamp);
    const original = { ...item };

    expect(
      await setFinishedAt({ ...options, input: { finishedAt: null } }),
    ).toEqual({
      libraryItemId: item.id,
      finishedAt: null,
    });
    expect(item).toEqual({ ...original, finishedAt: null });
    expect(update.mock.calls[0][0].data).toEqual({ finishedAt: null });
    expect(updateProgress).not.toHaveBeenCalled();
  });

  it.each([timestamp, null])(
    'keeps explicit retries idempotent (%s)',
    async (finishedAt) => {
      const { options } = fixture();
      const input = { ...options, input: { finishedAt } };
      const first = await setFinishedAt(input);
      expect(await setFinishedAt(input)).toEqual(first);
    },
  );

  it('normalizes a timezone offset to the same UTC instant', async () => {
    const { options } = fixture();
    const result = await setFinishedAt({
      ...options,
      input: { finishedAt: '2026-09-13T12:15:00+02:00' },
    });
    expect(result.finishedAt).toBe(timestamp);
  });

  it.each(['other-user', 'missing-item', 'archived-item'])(
    'rejects an unavailable item without any write (%s)',
    async (scenario) => {
      const { item, options, update } = fixture();
      if (scenario === 'other-user') options.userId = 'user-2';
      if (scenario === 'missing-item') options.libraryItemId = 'missing';
      if (scenario === 'archived-item') item.isArchived = true;

      await expect(setFinishedAt(options)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
      expect(item.finishedAt).toBeNull();
    },
  );

  it.each([
    undefined,
    null,
    [],
    {},
    { finishedAt: undefined },
    { finishedAt: 123 },
    { finishedAt: true },
    { finishedAt: '' },
    { finishedAt: '2026-09-13' },
    { finishedAt: '2026-09-13T10:15:00' },
    { finishedAt: '2026-02-30T10:15:00Z' },
    { finishedAt: 'not a date' },
    { finishedAt: timestamp, completionPercent: 100 },
  ])(
    'rejects malformed input before accessing the database (%j)',
    async (input) => {
      const { options, findFirst, update } = fixture();
      await expect(setFinishedAt({ ...options, input })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(findFirst).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
});
