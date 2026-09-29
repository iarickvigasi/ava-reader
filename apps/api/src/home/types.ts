import type { PdfLibraryRecord } from '../library/pdf-import/operations/library-summary';
import type { Prisma, User } from '@prisma/client';

export type LibraryItemRecord = Prisma.LibraryItemGetPayload<{
  include: {
    _count: { select: { annotations: true } };
    book: {
      include: {
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
      };
    };
    progress: true;
  };
}> & { book: { pdfImport?: PdfLibraryRecord | null } };

export type CatalogEntryRecord = Prisma.CatalogEntryGetPayload<{
  include: {
    book: {
      include: {
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
      };
    };
  };
}>;

export type HomeUser = Pick<
  User,
  'id' | 'avatarUrl' | 'displayName' | 'primaryEmail' | 'role'
>;
