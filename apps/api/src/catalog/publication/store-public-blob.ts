import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer } from '../../shared/blob-utils';
import { catalogBlobRequest } from './catalog-blob-request';

export async function storePublicBlob(
  prisma: Pick<PrismaService, 'storedBlob'> | Prisma.TransactionClient,
  data: {
    purpose: Prisma.StoredBlobCreateInput['purpose'];
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
    checksum: string;
    bytes: Uint8Array;
  },
) {
  const bytes = Buffer.from(data.bytes);
  if (
    checksumBuffer(bytes) !== data.checksum ||
    bytes.length !== data.sizeBytes
  )
    throw new Error('Public blob checksum mismatch');
  const metadata = {
    purpose: data.purpose,
    checksum: data.checksum,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    originalFilename: data.originalFilename,
  };
  const response = await catalogBlobRequest(metadata, bytes);
  const stored = (await response.json()) as {
    id: string;
    checksum: string;
    sizeBytes: number;
  };
  if (
    !/^[\da-f-]{36}$/i.test(stored.id) ||
    stored.checksum !== data.checksum ||
    stored.sizeBytes !== data.sizeBytes
  )
    throw new Error('Invalid public storage receipt');
  return prisma.storedBlob.create({
    data: { ...metadata, bytes: new Uint8Array(), catalogBlobId: stored.id },
  });
}
