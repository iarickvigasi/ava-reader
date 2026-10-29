import { catalogBlobRequest } from './catalog-blob-request';
import { checksumBuffer } from '../../shared/blob-utils';

export async function readStoredBlob(blob: {
  bytes: Uint8Array;
  catalogBlobId?: string | null;
  checksum?: string;
}) {
  if (!blob.catalogBlobId) return Buffer.from(blob.bytes);
  const response = await catalogBlobRequest({ blobId: blob.catalogBlobId });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (blob.checksum && checksumBuffer(bytes) !== blob.checksum)
    throw new Error('Catalog blob checksum mismatch');
  return bytes;
}
