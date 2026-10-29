import { BlobPurpose } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../shared/blob-utils';
import { detectBookFileFormat } from '../../shared/metadata-extractor';
import { inferMimeType } from '../../shared/book-utils';
import { storeBookBlob } from './store-book-blob';

export async function storeCatalogUpload(
  prisma: PrismaService,
  source?: Express.Multer.File,
  cover?: Express.Multer.File,
) {
  const [sourceBlob, coverBlob] = await Promise.all(
    [source, cover].map(async (file, index) => {
      if (!file) return null;
      return storeBookBlob(prisma, true, {
        data: {
          purpose:
            index === 0 ? BlobPurpose.BOOK_SOURCE : BlobPurpose.BOOK_COVER,
          mimeType:
            file.mimetype ||
            (index === 0
              ? inferMimeType(detectBookFileFormat(file))
              : 'application/octet-stream'),
          sizeBytes: file.buffer.length,
          originalFilename: file.originalname,
          checksum: checksumBuffer(file.buffer),
          bytes: toPrismaBytes(file.buffer),
        },
      });
    }),
  );
  return { sourceBlob, coverBlob };
}
