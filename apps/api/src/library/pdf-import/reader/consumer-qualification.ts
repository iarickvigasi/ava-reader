import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PdfReaderQualification } from '@prisma/client';
import { requireReaderQualification } from '../publication/qualification';
export async function qualifiedPdfConsumer(
  prisma: Pick<
    PrismaService,
    'pdfImportOperation' | 'libraryItem' | 'pdfReaderQualification'
  >,
  original: PdfReaderQualification,
  schema: string,
  build: string,
) {
  if (schema === 'ava-reader-3' && /^[a-f0-9]{64}$/.test(build)) {
    const rows = await prisma.pdfReaderQualification.findMany({
      where: {
        readerBuildFingerprint: build,
        adapterFingerprint: original.adapterFingerprint,
        schemaVersion: schema,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const row of rows) {
      try {
        return await requireReaderQualification(
          prisma,
          row.id,
          original.capabilities,
        );
      } catch {
        /* A failed or test-only record never authorizes a production consumer. */
      }
    }
  }
  throw new ConflictException({
    code: 'PDF_READER_UPGRADE_REQUIRED',
    message: 'Update AVA to read this book.',
  });
}
