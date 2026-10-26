import { CreditRole } from '#catalog-client';
import { editionData } from './edition-data';
import { ensureEditionWork } from './ensure-edition-work';
import { references } from './raw-fields';
import { resolveReferences } from './resolve-references';
import { writeIdentifiers } from './write-identifiers';
import { type Raw, type Tx } from './types';

export async function writeEdition(
  tx: Tx,
  sourceId: string,
  id: string,
  revision: number,
  raw: Raw,
) {
  const workId = await ensureEditionWork(tx, sourceId, raw);
  const authors = await resolveReferences(tx, sourceId, raw.authors, 'authors');
  const data = editionData(raw, workId, revision);
  await tx.edition.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  if (raw.authors !== undefined) {
    await tx.editionCredit.deleteMany({ where: { editionId: id } });
    await tx.editionCredit.createMany({
      data: authors.map((authorId, position) => ({
        editionId: id,
        authorId,
        position,
        role: CreditRole.AUTHOR,
      })),
    });
  }
  await writeIdentifiers(tx, id, raw);
  return authors.length < references(raw.authors, 'authors').length;
}
