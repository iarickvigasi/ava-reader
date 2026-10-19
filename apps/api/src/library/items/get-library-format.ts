import { createHash } from 'node:crypto';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { BookFileFormat, BookFileKind } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { getPdfArtifact } from '../pdf-import/artifacts/get-artifact';
import { getPublishedPdfEpub } from '../pdf-import/artifacts/get-epub';
import { ownedLibraryItemWhere } from './library-item-access';

// A reader downloads existing, owned bytes. Never use a candidate, reader
// package or a derived-file fallback as a downloadable publication.
export async function getLibraryFormat(
  prisma: PrismaService,
  userId: string,
  ref: string,
  format: string,
) {
  if (format !== 'epub' && format !== 'pdf')
    throw new NotFoundException('Format not available.');
  const item = await prisma.libraryItem.findFirst({
    where: ownedLibraryItemWhere(userId, ref),
    select: {
      id: true,
      bookId: true,
      book: {
        select: {
          pdfImportPrivate: true,
          pdfImport: { select: { id: true, sourceArtifactId: true } },
        },
      },
    },
  });
  if (!item) throw new NotFoundException('Book not found in library.');
  const operation = item.book.pdfImport;
  let blob;
  if (operation) {
    // Preserve the import's publication, integrity and ownership checks.
    blob = await (format === 'epub'
      ? getPublishedPdfEpub(prisma, userId, operation.id)
      : getPdfArtifact(
          prisma,
          userId,
          operation.id,
          operation.sourceArtifactId,
        ));
  } else {
    if (item.book.pdfImportPrivate)
      throw new NotFoundException('Format not available.');
    const files = await prisma.bookFile.findMany({
      where: {
        bookId: item.bookId,
        kind: BookFileKind.SOURCE,
        isPrimary: true,
        format: format === 'epub' ? BookFileFormat.EPUB : BookFileFormat.PDF,
      },
      include: { blob: true },
      take: 2,
    });
    if (files.length !== 1)
      throw new NotFoundException('Format not available.');
    blob = files[0].blob;
    const mime = format === 'epub' ? 'application/epub+zip' : 'application/pdf';
    if (
      blob.mimeType !== mime ||
      blob.sizeBytes !== blob.bytes.byteLength ||
      blob.checksum !== createHash('sha256').update(blob.bytes).digest('hex')
    )
      throw new ServiceUnavailableException('File integrity check failed.');
  }
  // Removal/archive while fetching must not complete a stale download.
  if (
    !(await prisma.libraryItem.findFirst({
      where: { id: item.id, userId, bookId: item.bookId, isArchived: false },
      select: { id: true },
    }))
  )
    throw new NotFoundException('Book not found in library.');
  return blob;
}
