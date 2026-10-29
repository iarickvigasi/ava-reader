import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { publishImport } from './publish-import';
import { loadImport } from './load-import';
import { syncPublication } from '../publication/sync-publication';
export async function publishReadingImport(
  prisma: PrismaService,
  reviewer: string,
  body: Record<string, unknown>,
) {
  if (
    !body ||
    typeof body.editionId !== 'string' ||
    typeof body.checksum !== 'string'
  )
    throw new BadRequestException('Missing import identity');
  if (
    !process.env.CATALOG_API_BASE_URL ||
    (process.env.READING_ASSET_SYNC_SECRET?.length ?? 0) < 32
  )
    throw new ServiceUnavailableException(
      'Publication synchronization is not configured',
    );
  const receipt = await publishImport(
    prisma,
    body.editionId,
    body.checksum,
    body.review,
    reviewer,
  );
  try {
    await syncPublication(prisma, receipt.id);
  } catch {
    throw new ServiceUnavailableException(
      'Publication saved; Explore synchronization is pending and will retry automatically',
    );
  }
  return (await loadImport(prisma, body.editionId, body.checksum)).receipt;
}
