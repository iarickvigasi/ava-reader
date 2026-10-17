import type { PrismaService } from '../../../prisma/prisma.service';
// Tombstoned book content can be purged without removing its minimal cost audit.
export function cleanupDeletedProviderPayloads(prisma: PrismaService) {
  return prisma.pdfProviderPayload.deleteMany({
    where: {
      call: {
        grant: {
          OR: [
            { operationId: null },
            { operation: { deletedAt: { not: null } } },
          ],
        },
      },
    },
  });
}
