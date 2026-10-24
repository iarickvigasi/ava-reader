import { randomUUID } from 'node:crypto';
import { references, text } from './raw-fields';
import { UnresolvedRecord, type Raw, type Tx } from './types';

export async function ensureEditionWork(tx: Tx, sourceId: string, raw: Raw) {
  const keys = references(raw.works, 'works');
  if (keys.length !== 1)
    throw new UnresolvedRecord('Edition needs exactly one linked work');
  const key = { sourceId, entityKind: 'WORK', externalId: keys[0] };
  const existing = await tx.sourceMapping.findUnique({
    where: { sourceId_entityKind_externalId: key },
  });
  if (existing?.workId) return existing.workId;
  const id = randomUUID();
  await tx.work.create({
    data: {
      id,
      originalTitle: text(raw.title)!,
      metadataIncomplete: true,
      revision: 0,
    },
  });
  await tx.sourceMapping.create({
    data: {
      ...key,
      workId: id,
      sourceUrl: `https://openlibrary.org${keys[0]}`,
      sourceRevision: '0',
      managedRevision: 0,
    },
  });
  await tx.catalogOutbox.create({
    data: { kind: 'WORK', entityId: id, revision: 0 },
  });
  return id;
}
