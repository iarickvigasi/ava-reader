import { randomUUID } from 'node:crypto';
import type { ImportRecord } from '#catalog-client';
import { object, text } from './raw-fields';
import { InvalidRecord, type Tx } from './types';
import { directStep, type ImportStep } from './import-operation';
import { applyAuthorBatch } from './apply-author-batch';
import { applyWorkBatch } from './apply-work-batch';
import { applyEditionBatch } from './apply-edition-batch';
import { writeBulkOutcomes } from './write-bulk-outcomes';

export async function applyNewBatch(
  tx: Tx,
  records: ImportRecord[],
  sourceId: string,
  step: ImportStep = directStep,
) {
  const kind = records[0]?.kind;
  const keys = records.map((row) => row.externalId!);
  if (
    records.length < 2 ||
    !kind ||
    records.some((row) => row.kind !== kind) ||
    new Set(keys).size !== keys.length
  ) {
    return { remaining: records, count: 0 };
  }
  const mappings = await step('sourceMapping.findMany', () =>
    tx.sourceMapping.findMany({
      where: { sourceId, entityKind: kind, externalId: { in: keys } },
      select: { externalId: true },
    }),
  );
  const mapped = new Set(mappings.map((row) => row.externalId));
  const rows = await step('prepareRecords', () =>
    Promise.resolve(
      records
        .filter((row) => !mapped.has(row.externalId!))
        .map((record) => {
          const raw = object(record.payload);
          if (!text(kind === 'AUTHOR' ? raw.name : raw.title))
            throw new InvalidRecord('Missing name/title');
          return { id: randomUUID(), record, raw, incomplete: false };
        }),
    ),
  );
  if (!rows.length) return { remaining: records, count: 0 };
  const applied =
    kind === 'AUTHOR'
      ? await applyAuthorBatch(tx, rows, step)
      : kind === 'WORK'
        ? await applyWorkBatch(tx, rows, sourceId, step)
        : await applyEditionBatch(tx, rows, sourceId, step);
  if (applied.length) await writeBulkOutcomes(tx, applied, sourceId, step);
  const ids = new Set(applied.map((row) => row.record.id));
  return {
    remaining: records.filter((row) => !ids.has(row.id)),
    count: applied.length,
  };
}
