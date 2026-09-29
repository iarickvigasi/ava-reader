import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';

// Candidates and internal reader/diagnostic bytes never become owner download shortcuts.
export async function getPdfArtifact(
  prisma: PrismaService,
  userId: string,
  operationId: string,
  artifactId: string,
) {
  const operation = await ownedPdfImport(prisma, userId, operationId);
  const artifact = await prisma.pdfArtifact.findFirst({
    where: {
      id: artifactId,
      operationId: operation.id,
      ownerId: userId,
      role: 'SOURCE_PDF',
      retention: 'OPERATION',
    },
    include: { blob: true },
  });
  if (!artifact || artifact.id !== operation.sourceArtifactId)
    throw new NotFoundException('Artifact not found.');
  await ownedPdfImport(prisma, userId, operationId);
  return artifact.blob;
}
