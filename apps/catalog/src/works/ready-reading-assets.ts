import type { Prisma } from '#catalog-client';

export const READY_READING_ASSET = {
  status: 'READY',
  mainCatalogEntryId: { not: null },
} satisfies Prisma.ReadingAssetWhereInput;
