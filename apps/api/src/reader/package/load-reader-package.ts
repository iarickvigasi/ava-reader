import type { PrismaService } from '../../prisma/prisma.service';
import type { ReaderPackage } from '../reader-types';
import { parseReaderPackage } from './parse-reader-package';
import {
  clearReaderPackageLoad,
  getCachedReaderPackage,
  getReaderPackageLoadInFlight,
  rememberReaderPackage,
  trackReaderPackageLoad,
} from './reader-package-cache';

async function loadBlobBytes(
  prisma: PrismaService,
  blobId: string,
): Promise<Buffer> {
  const blob = await prisma.storedBlob.findUniqueOrThrow({
    where: { id: blobId },
    select: { bytes: true },
  });
  return Buffer.from(blob.bytes);
}

export async function loadReaderPackage(
  prisma: PrismaService,
  blobId: string,
): Promise<ReaderPackage> {
  const cached = getCachedReaderPackage(blobId);
  if (cached) {
    return cached;
  }
  const inFlight = getReaderPackageLoadInFlight(blobId);
  if (inFlight) {
    return inFlight;
  }
  const loadPromise = (async () => {
    try {
      const bytes = await loadBlobBytes(prisma, blobId);
      const readerPackage = parseReaderPackage(bytes);
      return rememberReaderPackage(blobId, readerPackage);
    } finally {
      clearReaderPackageLoad(blobId);
    }
  })();
  trackReaderPackageLoad(blobId, loadPromise);
  return loadPromise;
}
