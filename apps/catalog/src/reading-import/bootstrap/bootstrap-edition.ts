import { localBootstrapFile } from './local-bootstrap-file';
import { bootstrapSource } from './bootstrap-source';
import type { CatalogDatabase } from '../../database/catalog-database';
import { CURATED_SOURCE } from '../candidate-source';
import type { Candidate } from '../types';
import type { BootstrapBook } from './read-bootstrap';
import { ensureCuratedDescription } from './ensure-curated-description';
export async function bootstrapEdition(
  db: CatalogDatabase,
  book: BootstrapBook,
): Promise<Candidate> {
  const cache = await localBootstrapFile(book.localFile);
  const { externalId, payload, payloadHash, sourceUrl, identity } =
    bootstrapSource(book);
  return db.$transaction(async (tx) => {
    const source = await tx.source.upsert({
      where: { key: CURATED_SOURCE },
      create: { key: CURATED_SOURCE, name: 'AVA curated classics' },
      update: {},
    });
    const key = { sourceId: source.id, entityKind: 'EDITION', externalId };
    let mapping = await tx.sourceMapping.findUnique({
      where: { sourceId_entityKind_externalId: key },
    });
    if (mapping && mapping.payloadHash !== payloadHash)
      throw new Error('Provider edition already describes another work');
    if (!mapping) {
      const workId = await ensureCuratedDescription(tx, source.id, book);
      const edition = await tx.edition.create({
        data: {
          workId,
          title: book.title,
          language: book.language,
          format: 'EBOOK',
        },
      });
      mapping = await tx.sourceMapping.create({
        data: {
          ...key,
          editionId: edition.id,
          sourceRevision: '1',
          payloadHash,
          sourceUrl,
        },
      });
      const run = await tx.importRun.create({
        data: {
          sourceId: source.id,
          checksum: payloadHash,
          adapterVersion: 1,
          filename: externalId,
          status: 'STAGED',
        },
      });
      await tx.importRecord.create({
        data: {
          runId: run.id,
          line: 1,
          kind: 'EDITION',
          externalId,
          revision: 1,
          payloadHash,
          payload,
          status: 'APPLIED',
        },
      });
    }
    const edition = await tx.edition.findUniqueOrThrow({
      where: { id: mapping.editionId! },
      include: { work: true },
    });
    if (edition.work.deletedAt || edition.language !== book.language)
      throw new Error('Curated edition changed; review its current metadata');
    return {
      sourceKey: CURATED_SOURCE,
      editionId: edition.id,
      workId: edition.workId,
      externalId,
      sourceRevision: '1',
      sourcePayloadHash: payloadHash,
      title: edition.title,
      authors: [book.author],
      language: book.language,
      ...(book.iaIdentifier ? { iaIdentifier: book.iaIdentifier } : {}),
      ...identity,
      filename: book.filename,
      review: null,
      ...cache,
    };
  });
}
