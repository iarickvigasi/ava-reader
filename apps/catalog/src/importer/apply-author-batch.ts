import { strings, text } from './raw-fields';
import { directStep, type BulkRow, type ImportStep } from './import-operation';
import type { Tx } from './types';

export async function applyAuthorBatch(
  tx: Tx,
  rows: BulkRow[],
  step: ImportStep = directStep,
) {
  const authors = await step('prepareAuthors', () =>
    Promise.resolve(
      rows.map((row) => ({
        ...row,
        aliases: strings(row.raw.alternate_names) ?? [],
        biography: text(row.raw.bio),
      })),
    ),
  );
  await step('author.createMany', () =>
    tx.author.createMany({
      data: authors.map(({ id, raw }) => ({
        id,
        displayName: text(raw.name)!,
        revision: 1,
      })),
    }),
  );
  const aliases = authors.flatMap(({ id, aliases }) =>
    aliases.map((name) => ({ authorId: id, name })),
  );
  if (aliases.length)
    await step('authorAlias.createMany', () =>
      tx.authorAlias.createMany({ data: aliases }),
    );
  const biographies = authors.flatMap(({ id, biography }) =>
    biography ? [{ authorId: id, locale: 'und', biography }] : [],
  );
  if (biographies.length)
    await step('authorText.createMany', () =>
      tx.authorText.createMany({ data: biographies }),
    );
  return rows;
}
