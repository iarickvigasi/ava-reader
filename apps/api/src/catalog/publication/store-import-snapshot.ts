import { catalogBlobRequest } from './catalog-blob-request';
import { checksumBuffer } from '../../shared/blob-utils';
import type { ImportManifest } from '../reading-import/manifest';

export async function storeImportSnapshot(manifest: ImportManifest) {
  const bytes = Buffer.from(
    JSON.stringify({
      metadata: manifest.metadata,
      fileMetadata: manifest.fileMetadata,
    }),
  );
  const checksum = checksumBuffer(bytes);
  const response = await catalogBlobRequest(
    {
      purpose: 'IMPORT_METADATA',
      checksum,
      sizeBytes: bytes.length,
      mimeType: 'application/json',
      originalFilename: `${manifest.editionId}-source-metadata.json`,
    },
    bytes,
  );
  const stored = (await response.json()) as {
    id: string;
    checksum: string;
    sizeBytes: number;
  };
  if (
    !/^[\da-f-]{36}$/i.test(stored.id) ||
    stored.checksum !== checksum ||
    stored.sizeBytes !== bytes.length
  )
    throw new Error('Invalid metadata snapshot receipt');
  return stored.id;
}
