import { references } from './raw-fields';
import { UnresolvedRecord, type Tx } from './types';

export async function resolveReferences(
  tx: Tx,
  sourceId: string,
  value: unknown,
  kind: 'authors' | 'works',
) {
  const keys = references(value, kind);
  const mappings = await tx.sourceMapping.findMany({
    where: {
      sourceId,
      entityKind: kind === 'authors' ? 'AUTHOR' : 'WORK',
      externalId: { in: keys },
    },
  });
  return keys.map((key) => {
    const mapping = mappings.find((row) => row.externalId === key);
    const id = kind === 'authors' ? mapping?.authorId : mapping?.workId;
    if (!id) throw new UnresolvedRecord(`Missing ${kind} reference: ${key}`);
    return id;
  });
}
