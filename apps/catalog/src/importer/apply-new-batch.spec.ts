import { applyNewBatch } from './apply-new-batch';
import { InvalidRecord } from './types';
import {
  records,
  findMany,
  writes,
  updateMany,
  tx,
} from '../../test/bulk-unit-fixture';

beforeEach(() => {
  jest.clearAllMocks();
  findMany.mockResolvedValue([]);
});

it('bulk inserts every table and marks outcomes together with stable mapping targets', async () => {
  expect(await applyNewBatch(tx, records, 'source')).toEqual({
    remaining: [],
    count: 2,
  });
  const authors = writes.author.createMany.mock.calls[0][0].data as {
    id: string;
  }[];
  expect(authors).toHaveLength(2);
  authors.forEach((author, index) => {
    expect(
      writes.sourceMapping.createMany.mock.calls[0][0].data[index],
    ).toMatchObject({
      authorId: author.id,
      externalId: records[index].externalId,
      sourceRevision: '2',
      managedRevision: 1,
    });
  });
  expect(writes.authorAlias.createMany.mock.calls[0][0].data).toHaveLength(2);
  expect(writes.authorText.createMany.mock.calls[0][0].data).toHaveLength(2);
  expect(writes.catalogOutbox.createMany).toHaveBeenCalledTimes(1);
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: { in: ['1', '2'] } },
    data: { status: 'APPLIED', diagnostic: null },
  });
});

it('bulk inserts new authors without including mapped authors', async () => {
  findMany.mockResolvedValue([{ externalId: records[0].externalId }]);
  expect(await applyNewBatch(tx, records, 'source')).toEqual({
    remaining: [records[0]],
    count: 1,
  });
  expect(writes.author.createMany.mock.calls[0][0].data).toHaveLength(1);
});

it('retains ordered application for duplicate source keys', async () => {
  expect(await applyNewBatch(tx, [records[0], records[0]], 'source')).toEqual({
    remaining: [records[0], records[0]],
    count: 0,
  });
  expect(writes.author.createMany).not.toHaveBeenCalled();
});

it('validates the whole group before any writes', async () => {
  const bad = {
    ...records[1],
    payload: { name: 'Bad author', alternate_names: 'invalid' },
  };
  await expect(
    applyNewBatch(tx, [records[0], bad], 'source'),
  ).rejects.toBeInstanceOf(InvalidRecord);
  expect(writes.author.createMany).not.toHaveBeenCalled();
});
