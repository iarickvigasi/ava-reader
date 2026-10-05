import type { ValidationAuthority } from './validation-authority';
import { requireValidationRun } from './validation-authority';
import { jobTransaction } from '../jobs/transaction';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import type { PdfRuntimeConfig } from '../../../pdf-conversion/runtime/runtime-config';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import { loadPublicationCandidate } from './load-candidate';
import { parseSourceReport } from './source-report';
import { validateCandidateEpub } from './epub-validator';
import { retainValidation } from './retain-validation';
import { PdfPublicationError } from './errors';
export async function validatePdfCandidate(
  prisma: PrismaService,
  operationId: string,
  settings: {
    runtime: PdfRuntimeConfig;
    semantic: SemanticValidator;
    signal?: AbortSignal;
    validationAuthority?: ValidationAuthority;
    leaseRemainingMs?: () => number;
  },
) {
  if (settings.validationAuthority)
    await jobTransaction(prisma, (tx) =>
      requireValidationRun(tx, settings.validationAuthority!),
    );
  else if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AVA_PDF_TEST_HOOKS !== '1'
  )
    throw new PdfPublicationError('PDF_VALIDATION_AUTHORITY_INVALID');
  const c = await loadPublicationCandidate(
    prisma,
    operationId,
    settings.semantic,
  );
  const prior = await prisma.pdfCandidateValidation.findUnique({
    where: {
      attemptId_validatorFingerprint: {
        attemptId: c.attempt.id,
        validatorFingerprint: settings.runtime.image.slice(7),
      },
    },
  });
  if (prior) return prior;
  const file = (id: string) => c.artifacts.find((a) => a.descriptorId === id)!;
  const canonical = file(c.outcome.canonical_book.id),
    epub = file(c.outcome.epub.id);
  const book = await validateContract(
    'ava-book-2',
    Buffer.from(canonical.blob.bytes),
    settings.semantic,
  );
  const sourceReport = parseSourceReport(
    Buffer.from(file(c.outcome.validation_report.id).blob.bytes),
    book,
    epub.checksum,
    true,
  );
  if (
    book.source.sha256 !== c.op.sourceSha256 ||
    book.resources.length !== c.outcome.resources.length ||
    book.resources.some(
      (r) =>
        !c.outcome.resources.some(
          (d) => d.id === r.id && d.path === r.path && d.sha256 === r.sha256,
        ),
    )
  )
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  const finalContentId = `content-${randomUUID()}`;
  const checked = await validateCandidateEpub({
    epub: Buffer.from(epub.blob.bytes),
    epubSha: epub.checksum,
    canonicalSha: sourceReport.canonical_sha256,
    finalContentId,
    ...settings,
  });
  // Python verifies the embedded canonical digest; source and EPUB JSON must also agree.
  if (!isDeepStrictEqual(book, checked.reader.book))
    throw new PdfPublicationError('PDF_CANONICAL_CONSERVATION_FAILED');
  return retainValidation(
    prisma,
    c,
    sourceReport,
    checked,
    book,
    finalContentId,
    settings.runtime.image.slice(7),
    settings.validationAuthority,
  );
}
