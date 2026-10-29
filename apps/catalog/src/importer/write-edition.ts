import { editionData } from './edition-data';
import { ensureEditionWork } from './ensure-edition-work';
import { references } from './raw-fields';
import { resolveReferences } from './resolve-references';
import { writeIdentifiers } from './write-identifiers';
import { mergeMetadata } from './merge-metadata';
import { writeImportCredits } from './write-import-credits';
import { type Raw, type Tx } from './types';

export async function writeEdition(
  tx: Tx,
  sourceId: string,
  id: string,
  revision: number,
  raw: Raw,
  conflicts: string[] = [],
) {
  const workId = await ensureEditionWork(tx, sourceId, raw);
  const authors = await resolveReferences(tx, sourceId, raw.authors, 'authors');
  const current = await tx.edition.findUnique({ where: { id } });
  const data = editionData(raw, workId, revision);
  const overrides = current?.metadataOverrides ?? [];
  await tx.edition.upsert({
    where: { id },
    create: { id, ...data },
    update: mergeMetadata(current, data, conflicts),
  });
  await writeImportCredits(tx, 'edition', id, authors, overrides, conflicts);
  await writeIdentifiers(tx, id, raw, overrides, conflicts);
  return authors.length < references(raw.authors, 'authors').length;
}
