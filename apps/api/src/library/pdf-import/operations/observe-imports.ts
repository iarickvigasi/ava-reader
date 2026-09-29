import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { pdfLibrarySummary, pdfLibrarySummarySelect } from './library-summary';

export async function observePdfImports(
  prisma: PrismaService,
  userId: string,
  ids: string,
) {
  const requested = [...new Set(ids.split(',').filter(Boolean))];
  if (
    requested.length > 100 ||
    requested.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
  )
    throw new BadRequestException('Invalid import identities.');
  if (!requested.length) return { imports: [] };
  const imports = await prisma.pdfImportOperation.findMany({
    where: { ownerId: userId, deletedAt: null, id: { in: requested } },
    select: pdfLibrarySummarySelect,
  });
  const items = await prisma.libraryItem.findMany({
    where: { userId, id: { in: imports.map((item) => item.libraryItemId) } },
    select: { id: true },
  });
  const owned = new Set(items.map((item) => item.id));
  return {
    imports: imports
      .filter((item) => owned.has(item.libraryItemId))
      .map(pdfLibrarySummary),
  };
}
