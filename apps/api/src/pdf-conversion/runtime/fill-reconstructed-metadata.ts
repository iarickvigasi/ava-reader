import { acceptedDisplayMetadata } from '../metadata/display-metadata';
import { validatedPackageLanguage } from '../metadata/package-language';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  CanonicalBookV2,
  MetadataClaim,
} from '../contracts/generated/ava-book-2';
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
  return acceptedDisplayMetadata(
    claims.filter((claim) => claim.origin === 'source'),
  );
}
export async function fillReconstructedMetadata(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
  expectedVersion: number,
  book: Pick<CanonicalBookV2, 'metadata' | 'profile_id'>,
) {
  const details = {
    ...sourceDisplayMetadata(book.metadata),
    language: validatedPackageLanguage(book),
  };
  if (!Object.keys(details).length) return;
  await fillPdfMetadata(
    prisma,
    claim.authority,
    claim.job.owner_id,
    claim.job.operation_id,
    claim.job.source.sha256,
    { ...details, expectedVersion },
    'validated-package',
  );
}
