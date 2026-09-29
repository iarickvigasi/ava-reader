import type { PrismaService } from '../../../prisma/prisma.service';

export async function cleanupExpiredPdfStaging(
  prisma: PrismaService,
  now = new Date(),
) {
  return prisma.pdfArtifact.deleteMany({
    where: {
      retention: 'STAGING',
      expiresAt: { lt: now },
      operationId: null,
      sourceFor: null,
    },
  });
}
