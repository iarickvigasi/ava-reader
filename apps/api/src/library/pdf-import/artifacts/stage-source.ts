import { BlobPurpose } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { toPrismaBytes } from '../../../shared/blob-utils';
import { PDF_IMPORT_PROFILE } from '../admission/profile';

export function stagePdfSource(input: {
  prisma: PrismaService;
  userId: string;
  file: Express.Multer.File;
  sourceSha256: string;
}) {
  return input.prisma.pdfArtifact.create({
    data: {
      owner: { connect: { id: input.userId } },
      role: 'SOURCE_PDF',
      retention: 'STAGING',
      expiresAt: new Date(Date.now() + PDF_IMPORT_PROFILE.stagingTtlMs),
      checksum: input.sourceSha256,
      sizeBytes: input.file.buffer.length,
      mimeType: 'application/pdf',
      blob: {
        create: {
          purpose: BlobPurpose.BOOK_SOURCE,
          mimeType: 'application/pdf',
          sizeBytes: input.file.buffer.length,
          originalFilename: input.file.originalname,
          checksum: input.sourceSha256,
          bytes: toPrismaBytes(input.file.buffer),
        },
      },
    },
  });
}
