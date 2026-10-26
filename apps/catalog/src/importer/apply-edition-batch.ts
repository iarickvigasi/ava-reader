import { CreditRole } from '#catalog-client';
import { references } from './raw-fields';
import { editionData } from './edition-data';
import { bulkAuthorReferences } from './bulk-author-references';
import { bulkEditionIdentifiers } from './bulk-edition-identifiers';
import type { BulkRow, ImportStep } from './import-operation';
import type { Tx } from './types';

export async function applyEditionBatch(
  tx: Tx,
  rows: BulkRow[],
  sourceId: string,
  step: ImportStep,
) {
  const keys = new Map(
    rows.map((row) => [row.id, references(row.raw.works, 'works')]),
  );
  const all = [
    ...new Set([...keys.values()].filter((keys) => keys.length === 1).flat()),
  ];
  const mappings = all.length
    ? await step('workReferences.findMany', () =>
        tx.sourceMapping.findMany({
          where: { sourceId, entityKind: 'WORK', externalId: { in: all } },
          select: { externalId: true, workId: true },
        }),
      )
    : [];
  const works = new Map(mappings.map((row) => [row.externalId, row.workId]));
  // Missing works must retain the ordered placeholder creation path, including shared references.
  const eligible = rows.filter(
    (row) => keys.get(row.id)!.length === 1 && works.get(keys.get(row.id)![0]),
  );
  if (!eligible.length) return [];
  const authors = await bulkAuthorReferences(tx, eligible, sourceId, step);
  await step('edition.createMany', () =>
    tx.edition.createMany({
      data: eligible.map(({ id, raw }) => ({
        id,
        ...editionData(raw, works.get(references(raw.works, 'works')[0])!, 1),
      })),
    }),
  );
  const credits = eligible.flatMap(({ id }) => {
    const ids = authors.get(id)!;
    return ids.map((authorId, position) => ({
      editionId: id,
      authorId,
      position,
      role: CreditRole.AUTHOR,
    }));
  });
  if (credits.length)
    await step('editionCredit.createMany', () =>
      tx.editionCredit.createMany({ data: credits }),
    );
  await bulkEditionIdentifiers(tx, eligible, step);
  return eligible;
}
