import type { PrismaService } from '../../prisma/prisma.service';
import type { MetadataClaim } from '../contracts/generated/ava-book-2';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import { fillPdfMetadata } from '../../library/pdf-import/metadata/fill-metadata';
import { jobTransaction } from '../../library/pdf-import/jobs/transaction';
import { requireAttempt } from '../../library/pdf-import/jobs/authority';

export function captureMetadataVersion(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
) {
  return jobTransaction(prisma, async (tx) => {
    const { attempt } = await requireAttempt(tx, claim.authority);
    const book = await tx.book.findUniqueOrThrow({
      where: { id: attempt.job.operation.bookId },
      select: { metadataEditVersion: true },
    });
    return book.metadataEditVersion;
  });
}
export function sourceDisplayMetadata(claims: MetadataClaim[]) {
  const source = claims.filter(
    (c) => c.status === 'accepted' && c.origin === 'source' && c.value?.trim(),
  );
  const values = (field: MetadataClaim['field']) => [
    ...new Set(
      source.filter((c) => c.field === field).map((c) => c.value!.trim()),
    ),
  ];
  const title = values('title');
  const language = values('language');
  const authors = [
    ...new Set(
      source
        .filter(
          (c) => c.field === 'contributor' && c.contributor_role === 'author',
        )
        .map((c) => c.value!.trim()),
    ),
  ];
  return {
    ...(title.length === 1 && title[0].length <= 1000
      ? { title: title[0] }
      : {}),
    ...(authors.length &&
    authors.length <= 100 &&
    authors.every((a) => a.length <= 1000)
      ? { authors }
      : {}),
    ...(language.length === 1 &&
    language[0].length >= 2 &&
    language[0].length <= 35
      ? { language: language[0] }
      : {}),
  };
}
export async function fillReconstructedMetadata(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
  expectedVersion: number,
  claims: MetadataClaim[],
) {
  const details = sourceDisplayMetadata(claims);
  if (!Object.keys(details).length) return;
  await fillPdfMetadata(
    prisma,
    claim.authority,
    claim.job.owner_id,
    claim.job.operation_id,
    claim.job.source.sha256,
    { ...details, expectedVersion },
  );
}
