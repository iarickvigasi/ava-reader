import { references } from './raw-fields';
import { workData } from './work-data';
import { resolveReferences } from './resolve-references';
import { mergeMetadata } from './merge-metadata';
import { writeImportTexts } from './write-import-texts';
import { writeImportCredits } from './write-import-credits';
import { readerCategories } from './reader-categories';
import type { Raw, Tx } from './types';

export async function writeWork(
  tx: Tx,
  sourceId: string,
  id: string,
  revision: number,
  raw: Raw,
  conflicts: string[] = [],
) {
  const authors = await resolveReferences(tx, sourceId, raw.authors, 'authors');
  const current = await tx.work.findUnique({ where: { id } });
  const data = workData(raw, revision);
  const overrides = current?.metadataOverrides ?? [];
  const patch = mergeMetadata(
    current?.metadataIncomplete ? { ...current, originalTitle: null } : current,
    data,
    conflicts,
  );
  if (Array.isArray(patch.subjects) && !overrides.includes('categories'))
    patch.categories = [
      ...new Set([
        ...(current?.categories ?? []),
        ...readerCategories(patch.subjects as string[]),
      ]),
    ];
  await tx.work.upsert({
    where: { id },
    create: { id, ...data },
    update: patch,
  });
  await writeImportTexts(tx, 'work', id, raw, overrides, conflicts);
  await writeImportCredits(tx, 'work', id, authors, overrides, conflicts);
  return authors.length < references(raw.authors, 'authors').length;
}
