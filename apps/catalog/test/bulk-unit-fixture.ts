import type { ImportRecord } from '#catalog-client';
import type { Tx } from '../src/importer/types';
export const records = [1, 2].map(
  (n): ImportRecord => ({
    runId: 'run',
    line: n,
    modifiedAt: null,
    status: 'PENDING',
    diagnostic: null,
    id: String(n),
    kind: 'AUTHOR',
    externalId: `/authors/OL${n}A`,
    revision: 2,
    payloadHash: 'hash',
    payload: {
      name: `Author ${n}`,
      alternate_names: ['Alias', 'Alias'],
      bio: { value: 'Biography' },
    },
  }),
);
export const findMany = jest.fn().mockResolvedValue([]);
const createMany = () =>
  jest
    .fn<Promise<{ count: number }>, [{ data: Record<string, unknown>[] }]>()
    .mockResolvedValue({ count: 2 });
export const writes = {
  author: { createMany: createMany() },
  authorAlias: { createMany: createMany() },
  authorText: { createMany: createMany() },
  sourceMapping: { createMany: createMany() },
  catalogOutbox: { createMany: createMany() },
};
export const updateMany = jest.fn();
export const tx = {
  ...writes,
  sourceMapping: { ...writes.sourceMapping, findMany },
  importRecord: { updateMany },
} as unknown as Tx;
