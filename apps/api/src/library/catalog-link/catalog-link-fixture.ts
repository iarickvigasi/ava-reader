import type { PrismaService } from '../../prisma/prisma.service';
export function fixture(item: object | null = { catalogLinkVersion: 0 }) {
  const findFirst = jest.fn().mockResolvedValue(item);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  return {
    findFirst,
    updateMany,
    prisma: {
      libraryItem: { findFirst, updateMany },
    } as unknown as PrismaService,
  };
}
