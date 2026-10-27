import type { CatalogDatabase } from '../database/catalog-database';
import type { ImportRecord } from '#catalog-client';
import { recordBytes } from './record-groups';

// Bound transient payload allocation too: never materialize hundreds of large JSON records at once.
const PAYLOAD_CHUNK_SIZE = 8;
export async function readPayloadPage(
  db: CatalogDatabase,
  ids: string[],
  maxBytes: number,
) {
  const records: ImportRecord[] = [];
  let bytes = 0;
  for (let offset = 0; offset < ids.length; offset += PAYLOAD_CHUNK_SIZE) {
    const rows = await db.importRecord.findMany({
      where: { id: { in: ids.slice(offset, offset + PAYLOAD_CHUNK_SIZE) } },
      orderBy: { id: 'asc' },
    });
    for (const row of rows) {
      const size = recordBytes(row);
      if (records.length && bytes + size > maxBytes) return records;
      records.push(row);
      bytes += size;
    }
    if (bytes >= maxBytes) break;
  }
  return records;
}
