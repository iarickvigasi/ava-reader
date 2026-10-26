import { isbnValues } from './isbn-values';
import type { BulkRow, ImportStep } from './import-operation';
import type { Tx } from './types';

export async function bulkEditionIdentifiers(
  tx: Tx,
  rows: BulkRow[],
  step: ImportStep,
) {
  const values = await step('prepareIdentifiers', () =>
    Promise.resolve(
      rows.map((row) => ({
        id: row.id,
        values: isbnValues(row.raw),
      })),
    ),
  );
  const all = [...new Set(values.flatMap((row) => row.values))];
  if (!all.length) return;
  await step('identifier.createMany', () =>
    tx.identifier.createMany({
      data: all.map((normalizedValue) => ({
        scheme: 'ISBN_13',
        normalizedValue,
      })),
      skipDuplicates: true,
    }),
  );
  const identifiers = await step('identifier.findMany', () =>
    tx.identifier.findMany({
      where: { scheme: 'ISBN_13', normalizedValue: { in: all } },
      select: { id: true, normalizedValue: true },
    }),
  );
  const ids = new Map(identifiers.map((row) => [row.normalizedValue, row.id]));
  await step('editionIdentifier.createMany', () =>
    tx.editionIdentifier.createMany({
      data: values.flatMap((row) =>
        row.values.map((value) => ({
          editionId: row.id,
          identifierId: ids.get(value)!,
        })),
      ),
    }),
  );
}
