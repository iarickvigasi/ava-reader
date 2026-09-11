import { BookFileFormat, BookFileKind } from '@prisma/client';

export function membershipTestBook(id: string) {
  return {
    id,
    slug: id,
    isArchived: false,
    offlineRequested: false,
    addedAt: new Date('2026-09-01T00:00:00Z'),
    lastOpenedAt: null,
    progress: null,
    book: {
      id: `content-${id}`,
      title: id,
      authors: ['Author'],
      coverBlob: null,
      files: [
        {
          format: BookFileFormat.EPUB,
          isPrimary: true,
          kind: BookFileKind.SOURCE,
        },
      ],
    },
  };
}
