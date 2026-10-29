import { BadRequestException } from '@nestjs/common';
import type { CatalogStatus } from '@prisma/client';

export function catalogPublicationChange(
  entry: {
    importKey: string | null;
    importPublishedAt: Date | null;
    status?: CatalogStatus;
  },
  status: CatalogStatus,
) {
  if (!entry.importKey) return { status };
  if (
    status === 'PUBLISHED' &&
    (!entry.importPublishedAt || entry.status !== 'PUBLISHED')
  )
    throw new BadRequestException(
      'Publish new imported copies through Explore; withdrawn copies cannot be republished',
    );
  return {
    status,
    importSyncPending: true,
    importSyncRevision: { increment: 1 },
  };
}
