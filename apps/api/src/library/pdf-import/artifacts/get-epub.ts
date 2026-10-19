import { createHash } from 'node:crypto';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';

export async function getPublishedPdfEpub(
  prisma: PrismaService,
  userId: string,
  operationId: string,
) {
  const operation = await ownedPdfImport(prisma, userId, operationId);
  if (operation.status !== 'READY' || !operation.finalContentId)
    throw new NotFoundException('EPUB not available.');
  const publication = await prisma.pdfPublication.findUnique({
    where: { operationId },
  });
  if (!publication || publication.finalContentId !== operation.finalContentId)
    throw new NotFoundException('EPUB not available.');
  const artifact = await prisma.pdfArtifact.findFirst({
    where: {
      id: publication.epubArtifactId,
      operationId,
      ownerId: userId,
      role: 'DERIVED_EPUB',
      retention: 'ACCEPTED',
    },
    include: { blob: true },
  });
  if (!artifact) throw new NotFoundException('EPUB not available.');
  if (
    artifact.sizeBytes !== artifact.blob.bytes.byteLength ||
    artifact.checksum !==
      createHash('sha256').update(artifact.blob.bytes).digest('hex') ||
    artifact.mimeType !== 'application/epub+zip' ||
    artifact.blob.checksum !== artifact.checksum ||
    artifact.blob.sizeBytes !== artifact.sizeBytes ||
    artifact.blob.mimeType !== 'application/epub+zip'
  )
    throw new ServiceUnavailableException('EPUB integrity check failed.');
  await ownedPdfImport(prisma, userId, operationId);
  return artifact.blob;
}
