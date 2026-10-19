import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer } from '../../shared/blob-utils';
import { importedCoverAuthority } from './cover-authority';
// A retained validated cover is metadata, independent of reader-build qualification.
export async function getImportedEpubCover(
  prisma: PrismaService,
  ownerId: string,
  libraryItemId: string,
) {
  const identity = await importedCoverAuthority(prisma, ownerId, libraryItemId);
  const resource = await prisma.canonicalEpubResource.findFirst({
    where: identity,
    include: { blob: true },
  });
  if (
    !resource ||
    !Number.isSafeInteger(resource.byteLength) ||
    resource.byteLength < 1 ||
    resource.byteLength > 200 * 1024 * 1024 ||
    !['image/png', 'image/jpeg'].includes(resource.mediaType) ||
    resource.blob.mimeType !== resource.mediaType ||
    resource.blob.checksum !== resource.sha256 ||
    resource.blob.sizeBytes !== resource.byteLength ||
    resource.blob.bytes.length !== resource.byteLength ||
    checksumBuffer(Buffer.from(resource.blob.bytes)) !== resource.sha256
  )
    throw new NotFoundException('Cover not found.');
  const current = await importedCoverAuthority(prisma, ownerId, libraryItemId);
  if (
    current.importId !== identity.importId ||
    current.blobId !== identity.blobId
  )
    throw new NotFoundException('Cover not found.');
  return resource.blob;
}
