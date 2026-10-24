import { PublicationFormat, CreditRole } from '#catalog-client';
import { openLibraryCover } from './open-library-cover';
import { ensureEditionWork } from './ensure-edition-work';
import { references, strings, text } from './raw-fields';
import { normalizeLanguage } from './normalize-language';
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
  const language = Array.isArray(raw.languages)
    ? normalizeLanguage(raw.languages[0])
    : undefined;
  const year = text(raw.publish_date)?.match(/\b([12]\d{3})\b/);
  const data = {
    title: text(raw.title)!,
    workId,
    ...openLibraryCover(raw.covers),
    language,
    publisher: strings(raw.publishers)?.[0],
    publishedYear: year ? Number(year[1]) : undefined,
    format: format(raw.physical_format),
    revision,
  };
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

function format(value: unknown) {
  const name = text(value)?.toLowerCase();
  if (!name) return undefined;
  if (['epub', 'ebook', 'e-book', 'electronic resource'].includes(name))
    return PublicationFormat.EBOOK;
  if (name.includes('paperback')) return PublicationFormat.PAPERBACK;
  if (name.includes('hardcover') || name.includes('hardback'))
    return PublicationFormat.HARDCOVER;
  if (name.includes('audio')) return PublicationFormat.AUDIOBOOK;
  return PublicationFormat.UNKNOWN;
}
