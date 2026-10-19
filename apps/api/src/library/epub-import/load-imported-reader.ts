import { importedResourceUrls } from './resource-urls';
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import { checksumBuffer } from '../../shared/blob-utils';
import { importedEpubAuthority } from './authority';
export async function loadImportedEpubReader(
  prisma: PrismaService,
  input: {
    ownerId: string;
    libraryItemId: string;
    schema: string;
    build: string;
  },
  semantic: SemanticValidator,
) {
  const initial = await prisma.canonicalEpubImport.findFirst({
    where: { ownerId: input.ownerId, libraryItemId: input.libraryItemId },
    include: { acceptance: true },
  });
  if (!initial?.acceptance) return null;
  const { record, qualification, consumerQualification } =
    await importedEpubAuthority(
      prisma,
      input.ownerId,
      initial.id,
      input.schema,
      input.build,
    );
  const file = await prisma.bookFile.findFirst({
    where: {
      id: record.readerFileId,
      bookId: record.bookId,
      kind: 'DERIVED_READER',
      format: 'READER_PACKAGE',
      isPrimary: true,
      processingStatus: 'READY',
    },
    include: { blob: true },
  });
  if (
    !file ||
    file.blob.checksum !== record.readerSha256 ||
    checksumBuffer(Buffer.from(file.blob.bytes)) !== record.readerSha256
  )
    throw new ConflictException('Prepared EPUB content is unavailable.');
  const readerPackage = await validateContract(
    'ava-reader-3',
    Buffer.from(file.blob.bytes),
    semantic,
  );
  if (
    readerPackage.final_content_id !== record.finalContentId ||
    readerPackage.canonical_sha256 !== record.canonicalDigest
  )
    throw new ConflictException('Prepared EPUB content changed.');
  if (
    readerPackage.required_capabilities.some(
      (c) =>
        !qualification.capabilities.includes(c) ||
        !consumerQualification.capabilities.includes(c),
    )
  )
    throw new ConflictException('Update AVA to read this book.');
  const resourceUrls = await importedResourceUrls(
    prisma,
    record.id,
    readerPackage,
  );
  await importedEpubAuthority(
    prisma,
    input.ownerId,
    record.id,
    input.schema,
    input.build,
  );
  return {
    kind: 'epub-import' as const,
    readerPackage,
    importRecord: record,
    resourceUrls,
  };
}
export type ImportedEpubReader = NonNullable<
  Awaited<ReturnType<typeof loadImportedEpubReader>>
>;
