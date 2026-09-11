import type { Prisma } from '@prisma/client';

// Full collection cards omit cover bytes and BookFile.readingProgressIndex;
// neither belongs in a collection-page or membership acknowledgment payload.
export const collectionDetailsInclude = {
  items: {
    include: {
      libraryItem: {
        include: {
          book: {
            include: {
              coverBlob: { select: { mimeType: true } },
              files: { select: { format: true, isPrimary: true, kind: true } },
            },
          },
          progress: true,
        },
      },
    },
  },
} satisfies Prisma.CollectionInclude;
