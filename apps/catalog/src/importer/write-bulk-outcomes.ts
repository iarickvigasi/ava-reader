import type { BulkRow, ImportStep } from './import-operation';
import type { Tx } from './types';

export async function writeBulkOutcomes(
  tx: Tx,
  rows: BulkRow[],
  sourceId: string,
  step: ImportStep,
) {
  await step('sourceMapping.createMany', () =>
    tx.sourceMapping.createMany({
      data: rows.map(({ id, record }) => ({
        sourceId,
        entityKind: record.kind!,
        externalId: record.externalId!,
        authorId: record.kind === 'AUTHOR' ? id : undefined,
        workId: record.kind === 'WORK' ? id : undefined,
        editionId: record.kind === 'EDITION' ? id : undefined,
        sourceRevision: String(record.revision),
        payloadHash: record.payloadHash,
        managedRevision: 1,
        retrievedAt: new Date(),
        sourceUrl: `https://openlibrary.org${record.externalId}`,
      })),
    }),
  );
  await step('catalogOutbox.createMany', () =>
    tx.catalogOutbox.createMany({
      data: rows.map(({ id, record }) => ({
        kind: record.kind!,
        entityId: id,
        revision: 1,
      })),
    }),
  );
  for (const incomplete of [false, true]) {
    const ids = rows
      .filter((row) => row.incomplete === incomplete)
      .map((row) => row.record.id);
    if (!ids.length) continue;
    await step('importRecord.updateMany', () =>
      tx.importRecord.updateMany({
        where: { id: { in: ids } },
        data: {
          status: incomplete ? 'UNRESOLVED' : 'APPLIED',
          diagnostic: incomplete
            ? 'Published; missing author references'
            : null,
        },
      }),
    );
  }
}
