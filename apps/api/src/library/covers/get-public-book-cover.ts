import type { PrismaService } from '../../prisma/prisma.service';

export async function getPublicBookCover(
  prisma: PrismaService,
  bookId: string,
) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      pdfImportPrivate: true,
      canonicalImportPrivate: true,
      pdfImport: { select: { id: true } },
      coverBlob: { select: { bytes: true, mimeType: true } },
    },
  });
  return book?.canonicalImportPrivate ||
    book?.pdfImportPrivate ||
    book?.pdfImport
    ? null
    : (book?.coverBlob ?? null);
}
