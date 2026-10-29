import { skippedOutcome } from './skipped-outcome';
import { importOutcome } from './import-outcome';
import { randomUUID } from 'node:crypto';
import type { ImportRecord } from '#catalog-client';
import { object } from './raw-fields';
import { checkVersion } from './check-version';
import { writeAuthor } from './write-author';
import { writeWork } from './write-work';
import { writeEdition } from './write-edition';
import { type Tx } from './types';

export async function applyRecord(
  tx: Tx,
  record: ImportRecord,
  sourceId: string,
) {
  const key = {
    sourceId,
    entityKind: record.kind!,
    externalId: record.externalId!,
  };
  const mapping = await tx.sourceMapping.findUnique({
    where: { sourceId_entityKind_externalId: key },
  });
  const version = await checkVersion(tx, record, mapping);
  if (version.skip) {
    await tx.importRecord.update({
      where: { id: record.id },
      data: skippedOutcome(record, version.incomplete),
    });
    return;
  }
  const id =
    mapping?.authorId ?? mapping?.workId ?? mapping?.editionId ?? randomUUID();
  const raw = object(record.payload);
  let incomplete = false;
  const conflicts: string[] = [];
  if (record.kind === 'AUTHOR')
    await writeAuthor(tx, id, version.revision, raw, conflicts);
  if (record.kind === 'WORK')
    incomplete = await writeWork(
      tx,
      sourceId,
      id,
      version.revision,
      raw,
      conflicts,
    );
  if (record.kind === 'EDITION')
    incomplete = await writeEdition(
      tx,
      sourceId,
      id,
      version.revision,
      raw,
      conflicts,
    );
  const data = {
    sourceRevision: String(record.revision),
    payloadHash: record.payloadHash,
    managedRevision: version.revision,
    retrievedAt: new Date(),
    sourceUrl: `https://openlibrary.org${record.externalId}`,
  };
  await tx.sourceMapping.upsert({
    where: { sourceId_entityKind_externalId: key },
    update: data,
    create: {
      ...key,
      ...data,
      authorId: record.kind === 'AUTHOR' ? id : undefined,
      workId: record.kind === 'WORK' ? id : undefined,
      editionId: record.kind === 'EDITION' ? id : undefined,
    },
  });
  await tx.catalogOutbox.create({
    data: { kind: record.kind!, entityId: id, revision: version.revision },
  });
  await tx.importRecord.update({
    where: { id: record.id },
    data: importOutcome(incomplete, conflicts),
  });
}
