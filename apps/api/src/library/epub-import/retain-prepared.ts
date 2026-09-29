import { bindImportedCover } from './bind-cover';
import { fillImportedMetadata } from './metadata';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { checksumBuffer } from '../../shared/blob-utils';
import { requireEpubClaim, type EpubClaim } from './claim-authority';
import type { PreparedCanonicalEpub } from './prepare-import';
import type { StagedEpub } from './stage-prepared';
export async function retainPreparedEpub(
  prisma: PrismaService,
  claim: EpubClaim,
  prepared: PreparedCanonicalEpub,
  staged: StagedEpub,
  fingerprint: string,
) {
  return jobTransaction(prisma, async (tx) => {
    const { run } = await requireEpubClaim(tx, claim);
    const source = await tx.bookFile.findUniqueOrThrow({
      where: { id: run.sourceFileId! },
      include: { blob: true },
    });
    if (
      run.canonicalContentId !== prepared.reader.final_content_id ||
      source.bookId !== run.bookId ||
      source.blob.checksum !== prepared.report.source_sha256 ||
      checksumBuffer(Buffer.from(source.blob.bytes)) !==
        prepared.report.source_sha256
    )
      throw new Error('EPUB_IMPORT_SOURCE_CHANGED');
    const reader = await tx.bookFile.create({
      data: {
        bookId: run.bookId,
        blobId: staged.readerBlobId,
        kind: 'DERIVED_READER',
        format: 'READER_PACKAGE',
        isPrimary: false,
        processingStatus: 'PROCESSING',
      },
    });
    const record = await tx.canonicalEpubImport.create({
      data: {
        ownerId: claim.ownerId,
        libraryItemId: claim.libraryItemId,
        bookId: run.bookId,
        sourceFileId: source.id,
        sourceSha256: prepared.report.source_sha256,
        readerFileId: reader.id,
        readerSha256: checksumBuffer(prepared.readerBytes),
        finalContentId: prepared.reader.final_content_id,
        canonicalDigest: prepared.reader.canonical_sha256,
        validatorFingerprint: fingerprint,
        validationReport: prepared.report as Prisma.InputJsonValue,
        resources: {
          create: prepared.reader.book.resources.map((r) => ({
            resourceId: r.id,
            blobId: staged.resources.get(r.sha256)!,
            sha256: r.sha256,
            mediaType: r.media_type,
            byteLength: r.byte_length,
          })),
        },
      },
    });
    await bindImportedCover(
      tx,
      run.bookId,
      prepared.reader.book,
      staged.resources,
    );
    await fillImportedMetadata(
      tx,
      run.bookId,
      source.blob.originalFilename,
      prepared.reader.book.metadata,
    );
    await requireEpubClaim(tx, claim);
    await tx.bookProcessingRun.update({
      where: { id: run.id },
      data: {
        outputFileId: reader.id,
        leaseExpiresAt: null,
        leaseTokenHash: null,
        errorMessage: null,
      },
    });
    return record;
  });
}
