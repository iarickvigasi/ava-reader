import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer } from '../../shared/blob-utils';
import { importedEpubAuthority } from './authority';
export async function getImportedEpubResource(
  prisma: PrismaService,
  ownerId: string,
  importId: string,
  resourceId: string,
  schema: string,
  build: string,
) {
  await importedEpubAuthority(prisma, ownerId, importId, schema, build);
  const resource = await prisma.canonicalEpubResource.findUnique({
    where: { importId_resourceId: { importId, resourceId } },
    include: { blob: true },
  });
  if (
    !resource ||
    !['image/png', 'image/jpeg'].includes(resource.mediaType) ||
    resource.blob.mimeType !== resource.mediaType ||
    resource.blob.checksum !== resource.sha256 ||
    resource.blob.sizeBytes !== resource.byteLength ||
    resource.blob.bytes.length !== resource.byteLength ||
    checksumBuffer(Buffer.from(resource.blob.bytes)) !== resource.sha256
  )
    throw new NotFoundException('Resource not found.');
  await importedEpubAuthority(prisma, ownerId, importId, schema, build);
  return resource.blob;
}
