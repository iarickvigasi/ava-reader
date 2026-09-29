import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer } from '../../../shared/blob-utils';
import { publishedPdfAuthority } from '../reader/published-authority';
export async function getPublishedPdfResource(
  prisma: PrismaService,
  ownerId: string,
  operationId: string,
  resourceId: string,
  schema: string,
  build: string,
) {
  const { publication } = await publishedPdfAuthority(
    prisma,
    ownerId,
    operationId,
    schema,
    build,
  );
  const map = publication.resourceMap;
  const id =
    map &&
    typeof map === 'object' &&
    !Array.isArray(map) &&
    Object.hasOwn(map, resourceId)
      ? map[resourceId]
      : null;
  if (typeof id !== 'string')
    throw new NotFoundException('Resource not found.');
  const a = await prisma.pdfArtifact.findFirst({
    where: {
      id,
      ownerId,
      operationId,
      role: 'RESOURCE',
      retention: 'ACCEPTED',
    },
    include: { blob: true },
  });
  if (
    !a ||
    !['image/png', 'image/jpeg'].includes(a.mimeType) ||
    a.mimeType !== a.blob.mimeType ||
    a.sizeBytes !== a.blob.sizeBytes ||
    a.checksum !== a.blob.checksum ||
    a.sizeBytes !== a.blob.bytes.length ||
    checksumBuffer(Buffer.from(a.blob.bytes)) !== a.checksum
  )
    throw new NotFoundException('Resource not found.');
  await publishedPdfAuthority(prisma, ownerId, operationId, schema, build);
  return a.blob;
}
