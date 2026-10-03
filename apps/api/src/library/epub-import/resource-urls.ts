import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ReaderPackageV3 } from '../../pdf-conversion/contracts/generated/ava-reader-3';
export async function importedResourceUrls(
  prisma: PrismaService,
  importId: string,
  readerPackage: ReaderPackageV3,
) {
  const resources = await prisma.canonicalEpubResource.findMany({
    where: { importId: importId },
  });
  if (
    resources.length !== readerPackage.book.resources.length ||
    readerPackage.book.resources.some(
      (r) =>
        !resources.some(
          (x) =>
            x.resourceId === r.id &&
            x.sha256 === r.sha256 &&
            x.byteLength === r.byte_length &&
            x.mediaType === r.media_type,
        ),
    )
  )
    throw new ConflictException('Prepared EPUB resources are unavailable.');
  return Object.fromEntries(
    resources.map((r) => [
      r.resourceId,
      `/api/library/epub-imports/${encodeURIComponent(importId)}/resources/${encodeURIComponent(r.resourceId)}`,
    ]),
  );
}
