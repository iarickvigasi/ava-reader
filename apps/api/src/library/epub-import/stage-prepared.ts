import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../shared/blob-utils';
import type { PreparedCanonicalEpub } from './prepare-import';
export async function stagePreparedEpub(
  prisma: PrismaService,
  prepared: PreparedCanonicalEpub,
) {
  const blobIds: string[] = [];
  async function store(
    bytes: Buffer,
    mimeType: string,
    originalFilename: string,
  ) {
    const blob = await prisma.storedBlob.create({
      data: {
        bytes: toPrismaBytes(bytes),
        checksum: checksumBuffer(bytes),
        mimeType,
        originalFilename,
        purpose: 'DERIVED_READER',
        sizeBytes: bytes.length,
      },
    });
    blobIds.push(blob.id);
    return blob.id;
  }
  const resources = new Map<string, string>();
  try {
    const readerBlobId = await store(
      prepared.readerBytes,
      'application/vnd.ava.reader-package+json',
      'reader.json',
    );
    for (const resource of prepared.reader.book.resources) {
      if (!resources.has(resource.sha256))
        resources.set(
          resource.sha256,
          await store(
            prepared.artifacts.get(`resources/${resource.sha256}`)!,
            resource.media_type,
            `image-${resource.sha256}`,
          ),
        );
    }
    return { readerBlobId, resources, blobIds };
  } catch (error) {
    for (const id of blobIds)
      await prisma.storedBlob.delete({ where: { id } }).catch(() => {});
    throw error;
  }
}
export type StagedEpub = Awaited<ReturnType<typeof stagePreparedEpub>>;
