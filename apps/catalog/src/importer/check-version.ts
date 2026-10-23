import { Prisma, type ImportRecord, type SourceMapping } from '#catalog-client';
import { ConflictingRecord, type Tx } from './types';

export async function checkVersion(
  tx: Tx,
  record: ImportRecord,
  mapping: SourceMapping | null,
) {
  if (!mapping) return { skip: false, revision: 1 };
  const current = Number(mapping.sourceRevision);
  if (current > record.revision!) return { skip: true, revision: 0 };
  if (current === record.revision) {
    if (mapping.payloadHash !== record.payloadHash)
      throw new ConflictingRecord('Same revision has different JSON');
    return { skip: true, revision: 0 };
  }
  const table = mapping.authorId
    ? 'Author'
    : mapping.workId
      ? 'Work'
      : 'Edition';
  const id = mapping.authorId ?? mapping.workId ?? mapping.editionId;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')}
    WHERE id = ${id}::uuid FOR UPDATE`);
  const target = mapping.authorId
    ? await tx.author.findUnique({ where: { id: mapping.authorId } })
    : mapping.workId
      ? await tx.work.findUnique({ where: { id: mapping.workId } })
      : await tx.edition.findUnique({ where: { id: mapping.editionId! } });
  if (!target || target.revision !== mapping.managedRevision) {
    throw new ConflictingRecord(
      'Canonical entry changed outside this importer',
    );
  }
  return { skip: false, revision: target.revision + 1 };
}
