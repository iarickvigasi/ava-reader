import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { loadCatalogLink } from './load-catalog-link';
export async function saveCatalogLink(
  prisma: PrismaService,
  userId: string,
  libraryItemId: string,
  body: {
    mutationId?: unknown;
    version?: unknown;
    workId?: unknown;
    editionId?: unknown;
  },
) {
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if (
    !body ||
    !Number.isSafeInteger(body.version) ||
    Number(body.version) < 0 ||
    typeof body.mutationId !== 'string' ||
    !uuid.test(body.mutationId) ||
    (body.workId !== null &&
      (typeof body.workId !== 'string' || !uuid.test(body.workId))) ||
    body.editionId != null
  )
    throw new BadRequestException('Invalid catalog link');
  const where = {
    id: libraryItemId,
    userId,
    source: 'IMPORTED' as const,
    book: { visibility: 'PRIVATE' as const, privateOwnerId: userId },
  };
  const item = await prisma.libraryItem.findFirst({ where });
  if (!item) throw new NotFoundException('Private upload not found');
  if (item.catalogLinkMutationId === body.mutationId)
    return { link: item.catalogLink, version: item.catalogLinkVersion };
  if (item.catalogLinkVersion !== body.version)
    throw new ConflictException({
      message: 'Link changed on another device; choose again',
      link: item.catalogLink,
      version: item.catalogLinkVersion,
    });
  const link = body.workId === null ? null : await loadCatalogLink(body.workId);
  const updated = await prisma.libraryItem.updateMany({
    where: { ...where, catalogLinkVersion: Number(body.version) },
    data: {
      catalogLink: link ?? Prisma.DbNull,
      catalogLinkMutationId: body.mutationId,
      catalogLinkVersion: { increment: 1 },
    },
  });
  if (!updated.count)
    throw new ConflictException('Link changed; reload before linking');
  return { link, version: Number(body.version) + 1 };
}
