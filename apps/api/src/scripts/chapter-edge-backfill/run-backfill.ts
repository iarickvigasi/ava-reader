import type { PrismaClient } from '@prisma/client';
import { processFile } from './process-file';

export async function runEdgeBackfill(
  prisma: PrismaClient,
  apply: boolean,
  bookId?: string,
) {
  let cursor: string | undefined;
  const totals: Record<string, number> = {
    scanned: 0,
    unchanged: 0,
    blocked: 0,
    applied: 0,
    'dry-run': 0,
    failed: 0,
  };
  while (true) {
    const files = await prisma.bookFile.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined,
        bookId,
        kind: 'DERIVED_READER',
        format: 'READER_PACKAGE',
        isPrimary: true,
        processingStatus: 'READY',
        book: {
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
        const report = await processFile(prisma, file, apply);
        totals[report.status]++;
        console.log(
          JSON.stringify({ bookId: file.bookId, fileId: file.id, ...report }),
        );
      } catch (error) {
        totals.failed++;
        console.error(
          JSON.stringify({
            bookId: file.bookId,
            fileId: file.id,
            error: String(error),
          }),
        );
      }
    }
    cursor = files.at(-1)!.id;
  }
  console.log(JSON.stringify({ summary: totals, apply }));
  if (totals.failed || (apply && totals.blocked))
    throw new Error('Some books could not be updated; inspect the report');
}
