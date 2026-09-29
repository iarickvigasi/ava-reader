import type { ValidationAuthority } from './validation-authority';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { loadPublicationCandidate } from './load-candidate';
import type { parseSourceReport } from './source-report';
import type { validateCandidateEpub } from './epub-validator';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { stagePublicationArtifact } from './stage-publication-artifact';
import { persistValidation } from './persist-validation';
export async function retainValidation(
  prisma: PrismaService,
  c: Awaited<ReturnType<typeof loadPublicationCandidate>>,
  sourceReport: ReturnType<typeof parseSourceReport>,
  checked: Awaited<ReturnType<typeof validateCandidateEpub>>,
  book: CanonicalBookV2,
  finalContentId: string,
  validatorFingerprint: string,
  validationAuthority?: ValidationAuthority,
) {
  const file = (id: string) => c.artifacts.find((a) => a.descriptorId === id)!;
  const canonical = file(c.outcome.canonical_book.id),
    epub = file(c.outcome.epub.id);
  const hardBlocks = sourceReport.findings
    .filter((f) => f.severity === 'blocking')
    .map((f) => f.code);
  const reviewFindings = [
    ...new Set([
      ...sourceReport.findings
        .filter((f) => f.severity === 'review')
        .map((f) => f.code),
      ...checked.epubcheck.warnings.map((code) => 'EPUBCHECK:' + code),
    ]),
  ];
  const reader = await stagePublicationArtifact(
    prisma,
    c.op.ownerId,
    'DERIVED_READER',
    checked.readerBytes,
  );
  const report = await stagePublicationArtifact(
    prisma,
    c.op.ownerId,
    'VALIDATION_REPORT',
    Buffer.from(
      JSON.stringify({
        schema_version: 'ava-publication-report-1',
        source: sourceReport,
        epubcheck: checked.epubcheck,
        source_artifact_sha256: c.op.sourceSha256,
        canonical_artifact_sha256: canonical.checksum,
        reader_artifact_sha256: reader.checksum,
        validator_fingerprint: validatorFingerprint,
        hardBlocks,
        reviewFindings,
      }),
    ),
  );
  return persistValidation(
    prisma,
    c,
    {
      operationId: c.op.id,
      attemptId: c.attempt.id,
      candidateId: c.outcome.candidate_id,
      candidateResultSha256: c.attempt.resultSha256!,
      validatorFingerprint: validatorFingerprint,
      sourceSha256: c.op.sourceSha256,
      configSha256: c.op.configSha256,
      generation: c.op.generation,
      cancellationEpoch: c.op.cancellationEpoch,
      attemptFence: c.job.attemptFence,
      canonicalArtifactId: canonical.id,
      canonicalDigest: sourceReport.canonical_sha256,
      epubArtifactId: epub.id,
      readerArtifactId: reader.id,
      reportArtifactId: report.id,
      finalContentId,
      resourceMap: Object.fromEntries(
        book.resources.map((r) => [r.id, file(r.id).id]),
      ),
      verdict: hardBlocks.length
        ? 'BLOCKED'
        : reviewFindings.length
          ? 'REVIEW'
          : 'PASS',
      hardBlocks,
      reviewFindings,
    },
    [reader, report],
    validationAuthority,
  );
}
