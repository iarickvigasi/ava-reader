import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer } from '../../../shared/blob-utils';
import { getPdfReview } from './snapshot';
export async function getPdfReviewArtifact(
  prisma: PrismaService,
  reviewerId: string,
  operationId: string,
  artifactId: string,
) {
  const before = await getPdfReview(prisma, reviewerId, operationId);
  const descriptor = [
    before.source,
    before.candidate,
    before.canonical,
    before.report,
    ...before.resources,
  ].find((a) => a.artifactId === artifactId);
  if (!descriptor) throw new NotFoundException('Review evidence not found.');
  const a = await prisma.pdfArtifact.findFirst({
    where: { id: artifactId, operationId },
    include: { blob: true },
  });
  if (
    !a ||
    a.checksum !== descriptor.sha256 ||
    a.sizeBytes !== descriptor.byteLength ||
    a.mimeType !== descriptor.mediaType ||
    a.blob.mimeType !== a.mimeType ||
    a.blob.sizeBytes !== a.sizeBytes ||
    a.blob.checksum !== a.checksum ||
    a.blob.bytes.length !== a.sizeBytes ||
    checksumBuffer(Buffer.from(a.blob.bytes)) !== a.checksum
  )
    throw new NotFoundException('Review evidence not found.');
  const after = await getPdfReview(prisma, reviewerId, operationId);
  if (after.validationId !== before.validationId)
    throw new NotFoundException('Review changed.');
  return a.blob;
}
