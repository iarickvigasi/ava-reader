import type { ImportRecord } from '#catalog-client';

export function recordBytes(record: ImportRecord) {
  return Buffer.byteLength(JSON.stringify(record.payload ?? null));
}

export function* recordGroups(
  records: ImportRecord[],
  maxRows: number,
  maxBytes: number,
) {
  let group: ImportRecord[] = [],
    bytes = 0;
  for (const record of records) {
    const size = recordBytes(record);
    if (group.length && (group.length >= maxRows || bytes + size > maxBytes)) {
      yield group;
      group = [];
      bytes = 0;
    }
    group.push(record);
    bytes += size;
  }
  if (group.length) yield group;
}
