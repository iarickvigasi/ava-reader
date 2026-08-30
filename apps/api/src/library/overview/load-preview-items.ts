import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type LibraryPreviewBookRecord = Prisma.LibraryItemGetPayload<{
  select: {
    id: true;
    slug: true;
    offlineRequested: true;
    book: {
      select: {
        authors: true;
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
        id: true;
        title: true;
      };
    };
  };
}>;

// Phase 2 of GET /library: full book detail for only the preview library
// items we actually need to render. Cover blob is selected without `bytes` so
// the response shape stays small — the browser fetches cover images by URL.
export async function loadPreviewItems(
  prisma: PrismaService,
  previewIds: string[],
): Promise<LibraryPreviewBookRecord[]> {
  if (previewIds.length === 0) {
    return [];
  }
  return prisma.libraryItem.findMany({
    where: { id: { in: previewIds } },
    select: {
      id: true,
      slug: true,
      offlineRequested: true,
      book: {
        select: {
          authors: true,
          coverBlob: { select: { mimeType: true } },
          files: {
            select: { format: true, isPrimary: true, kind: true },
          },
          id: true,
          title: true,
        },
      },
    },
  });
}
