import type { PrismaClient } from '@prisma/client';
import { parseReaderPackage } from '../../reader/package/parse-reader-package';
import type { ReaderPackage } from '../../reader/reader-types';
import { relabelPackage } from './relabel-package';
import { relabelIndex } from './relabel-index';
import { savePackage } from './save-package';

export async function runBackfill(prisma: PrismaClient, apply: boolean) {
  let cursor: string | undefined;
  const totals = { scanned: 0, changed: 0, chapters: 0, failed: 0 };
  while (true) {
    const files = await prisma.bookFile.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined,
        kind: 'DERIVED_READER',
        format: 'READER_PACKAGE',
        isPrimary: true,
        processingStatus: 'READY',
        book: {
          // Accepted PDF/generated-EPUB packages have immutable content identities.
          pdfImportPrivate: false,
          canonicalImportPrivate: false,
          libraryItems: { some: {} },
          files: { some: { kind: 'SOURCE', format: 'EPUB', isPrimary: true } },
        },
      },
      orderBy: { id: 'asc' },
      take: 25,
    });
    if (!files.length) break;
    for (const file of files) {
      totals.scanned++;
      try {
        const blob = await prisma.storedBlob.findUniqueOrThrow({
          where: { id: file.blobId },
          select: { bytes: true },
        });
        const bytes = Buffer.from(blob.bytes);
        parseReaderPackage(bytes); // Validate with the reader's supported format.
        // Retain raw metadata and content: this is a label-only edit.
        const raw = JSON.parse(bytes.toString('utf8')) as ReaderPackage;
        const { readerPackage, changes } = relabelPackage(raw);
        if (!changes.length) continue;
        const index = relabelIndex(file.readingProgressIndex, changes);
        const saved = apply
          ? await savePackage(prisma, file, readerPackage, index)
          : null;
        totals.changed++;
        totals.chapters += changes.length;
        console.log(
          JSON.stringify({
            mode: apply ? 'applied' : 'dry-run',
            bookId: file.bookId,
            fileId: file.id,
            changes,
            ...saved,
          }),
        );
      } catch (error) {
        totals.failed++;
        console.error(
          JSON.stringify({ fileId: file.id, error: String(error) }),
        );
      }
    }
    cursor = files.at(-1)!.id;
  }
  console.log(JSON.stringify({ summary: totals, apply }));
  if (totals.failed)
    throw new Error(`${totals.failed} files failed; see report and rerun`);
}
