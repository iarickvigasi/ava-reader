import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { storePublicBlob } from './store-public-blob';

export function storeBookBlob(
  prisma: Pick<PrismaService, 'storedBlob'> | Prisma.TransactionClient,
  publicCopy: boolean,
  input: { data: Parameters<typeof storePublicBlob>[1] },
) {
  return publicCopy
    ? storePublicBlob(prisma, input.data)
    : prisma.storedBlob.create({
        data: { ...input.data, bytes: Uint8Array.from(input.data.bytes) },
      });
}
