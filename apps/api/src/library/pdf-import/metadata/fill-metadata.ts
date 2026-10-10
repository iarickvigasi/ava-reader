import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { titleFromFilename } from '../../../shared/blob-utils';
import { requireAttempt } from '../jobs/authority';
import { jobTransaction } from '../jobs/transaction';
import { JobAuthorityError } from '../jobs/errors';
import type { AttemptAuthority } from '../jobs/types';
import { parsePdfMetadata } from './metadata-input';

// Internal extraction handoff, not an HTTP mutation or publication path.
export async function fillPdfMetadata(
  prisma: PrismaService,
  authority: AttemptAuthority,
  userId: string,
  operationId: string,
  sourceSha256: string,
  input: unknown,
  languageOrigin?: 'validated-package',
) {
  authority = { ...authority };
  const { expectedVersion, ...candidate } = parsePdfMetadata(input);
  return jobTransaction(prisma, async (tx) => {
    const { attempt, job } = await requireAttempt(tx, authority);
    const current = attempt.job.operation;
    if (
      current.ownerId !== userId ||
      current.id !== operationId ||
      current.sourceSha256 !== sourceSha256 ||
      job.owner_id !== userId ||
      job.operation_id !== operationId ||
      job.source.sha256 !== sourceSha256
    )
      throw new JobAuthorityError();
    const book = await tx.book.findUniqueOrThrow({
      where: { id: current.bookId },
    });
    const source = await tx.pdfArtifact.findUniqueOrThrow({
      where: { id: current.sourceArtifactId },
      include: { blob: { select: { originalFilename: true } } },
    });
    await tx.pdfMetadataClaim.createMany({
      data: Object.entries(candidate).map(([field, value]) => ({
        operationId,
        field,
        value: value === null ? Prisma.JsonNull : value,
        origin:
          field === 'language' && languageOrigin
            ? languageOrigin
            : 'extraction',
        sourceSha256,
        observedVersion: expectedVersion,
        evidence: {
          source:
            field === 'language' && languageOrigin
              ? 'validated-package-language'
              : 'source-backed-worker',
          sourceSha256,
        },
      })),
    });
    const fill: {
      title?: string;
      authors?: string[];
      language?: string | null;
    } = {};
    if (
      candidate.title &&
      candidate.title !== book.title &&
      book.title === titleFromFilename(source.blob.originalFilename)
    )
      fill.title = candidate.title;
    if (candidate.authors?.length && !book.authors.length)
      fill.authors = candidate.authors;
    if (candidate.language && !book.language)
      fill.language = candidate.language;
    for (const field of book.metadataUserFields)
      delete fill[field as keyof typeof fill];
    // requireAttempt holds the LibraryItem lock shared with metadata edits. Fill
    // eligible fields from that current snapshot; retain the worker's old version
    // on its source claims rather than blocking unrelated untouched fields.
    const currentVersion = book.metadataEditVersion;
    if (!Object.keys(fill).length || expectedVersion > currentVersion) {
      await requireAttempt(tx, authority);
      return { applied: false, metadataEditVersion: currentVersion };
    }
    const updated = await tx.book.updateMany({
      where: { id: book.id, metadataEditVersion: currentVersion },
      data: { ...fill, metadataEditVersion: { increment: 1 } },
    });
    await requireAttempt(tx, authority);
    return {
      applied: Boolean(updated.count),
      metadataEditVersion: updated.count ? currentVersion + 1 : currentVersion,
    };
  });
}
