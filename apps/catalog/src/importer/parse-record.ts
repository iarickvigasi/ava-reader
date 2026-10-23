import { createHash } from 'node:crypto';
import type { Prisma } from '#catalog-client';
import { object, text } from './raw-fields';
import { InvalidRecord, type DumpRecord, type Kind } from './types';

const RECORD_TYPES: Record<string, { kind: Kind; key: RegExp }> = {
  '/type/author': { kind: 'AUTHOR', key: /^\/authors\/OL\d+A$/ },
  '/type/work': { kind: 'WORK', key: /^\/works\/OL\d+W$/ },
  '/type/edition': { kind: 'EDITION', key: /^\/books\/OL\d+M$/ },
};

export function parseRecord(line: string | null): DumpRecord {
  if (line === null) throw new InvalidRecord('Line exceeds 8 MiB');
  const columns = line.split('\t');
  if (columns.length !== 5)
    throw new InvalidRecord('Expected five TSV columns');
  const [type, externalId, version, modified, json] = columns;
  const definition = RECORD_TYPES[type];
  if (!definition)
    throw new InvalidRecord(`Unsupported record type: ${type.slice(0, 60)}`);
  if (!definition.key.test(externalId))
    throw new InvalidRecord('Invalid source key');
  const revision = Number(version);
  if (
    !/^\d+$/.test(version) ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    revision > 2147483647
  ) {
    throw new InvalidRecord('Invalid source revision');
  }
  const modifiedAt = new Date(
    modified.endsWith('Z') ? modified : `${modified}Z`,
  );
  if (!Number.isFinite(modifiedAt.getTime()))
    throw new InvalidRecord('Invalid modified timestamp');
  let payload: ReturnType<typeof object>;
  try {
    payload = object(JSON.parse(json));
  } catch {
    throw new InvalidRecord('Invalid JSON object');
  }
  if (payload.key !== externalId || object(payload.type).key !== type) {
    throw new InvalidRecord('TSV identity does not match JSON identity');
  }
  if (!text(definition.kind === 'AUTHOR' ? payload.name : payload.title)) {
    throw new InvalidRecord('Missing name/title');
  }
  return {
    kind: definition.kind,
    externalId,
    revision,
    modifiedAt,
    payloadHash: createHash('sha256').update(json).digest('hex'),
    payload: payload as Prisma.InputJsonObject,
  };
}
