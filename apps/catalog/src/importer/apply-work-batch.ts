import { text } from './raw-fields';
import { workData } from './work-data';
import { bulkAuthorReferences } from './bulk-author-references';
import type { BulkRow, ImportStep } from './import-operation';
import type { Tx } from './types';

export async function applyWorkBatch(
  tx: Tx,
  rows: BulkRow[],
  sourceId: string,
  step: ImportStep,
) {
  const authors = await bulkAuthorReferences(tx, rows, sourceId, step);
  const works = await step('prepareWorks', () =>
    Promise.resolve(
      rows.map((row) => ({ ...row, data: workData(row.raw, 1) })),
    ),
  );
  await step('work.createMany', () =>
    tx.work.createMany({
      data: works.map(({ id, data }) => ({ id, ...data })),
    }),
  );
  await step('workText.createMany', () =>
    tx.workText.createMany({
      data: works.map(({ id, raw, data }) => ({
        workId: id,
        locale: data.originalLanguage ?? 'und',
        title: data.originalTitle,
        description: text(raw.description),
      })),
    }),
  );
  const credits = works.flatMap(({ id }) =>
    authors
      .get(id)!
      .map((authorId, position) => ({ workId: id, authorId, position })),
  );
  if (credits.length)
    await step('workCredit.createMany', () =>
      tx.workCredit.createMany({ data: credits }),
    );
  return rows;
}
