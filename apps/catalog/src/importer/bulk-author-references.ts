import { references } from './raw-fields';
import type { BulkRow, ImportStep } from './import-operation';
import type { Tx } from './types';

export async function bulkAuthorReferences(
  tx: Tx,
  rows: BulkRow[],
  sourceId: string,
  step: ImportStep,
) {
  const keys = new Map(
    rows.map((row) => [row.id, references(row.raw.authors, 'authors')]),
  );
  const all = [...new Set([...keys.values()].flat())];
  const mappings = all.length
    ? await step('authorReferences.findMany', () =>
        tx.sourceMapping.findMany({
          where: { sourceId, entityKind: 'AUTHOR', externalId: { in: all } },
          select: { externalId: true, authorId: true },
        }),
      )
    : [];
  const authors = new Map(
    mappings.map((row) => [row.externalId, row.authorId]),
  );
  return new Map(
    rows.map((row) => {
      const wanted = keys.get(row.id)!;
      const ids = wanted.flatMap((key) => authors.get(key) ?? []);
      row.incomplete = ids.length < wanted.length;
      return [row.id, ids];
    }),
  );
}
