import { promotePublicationArtifacts } from './promote-publication';
import type { WorkerCredential } from '../jobs/types';
import { authenticateWorker } from '../jobs/authenticate-worker';
import { installPublishedFiles } from './install-files';
import { bindPublishedCover } from './bind-cover';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../../shared/blob-utils';
import type { AcceptedContentV1 } from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';
import { acceptedManifest } from './accepted-manifest';
import { jobTransaction } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { assertValidationScope } from './validation-scope';
import { assertPublicationProviderClearance } from './provider-clearance';
import { requireReaderQualification } from './qualification';
import { assertReviewClearance } from './review-clearance';
import { PdfPublicationError } from './errors';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
import {
  workEventDetails,
  workEventTiming,
  type ConversionWorkTiming,
} from '../reports/work-timing';
export async function commitPublication(
  prisma: PrismaService,
  validationId: string,
  qualificationId: string,
  accepted: AcceptedContentV1,
  bytes: Buffer,
  required: string[],
  credential?: WorkerCredential,
  finishWork?: () => ConversionWorkTiming | undefined,
) {
  return jobTransaction(prisma, async (tx) => {
    await costLock(tx);
    if (credential) await authenticateWorker(tx, credential);
    else if (
      process.env.NODE_ENV !== 'test' ||
      process.env.AVA_PDF_TEST_HOOKS !== '1'
    )
      throw new PdfPublicationError('PDF_VALIDATION_AUTHORITY_INVALID');
    const prior = await tx.pdfPublication.findUnique({
      where: { operationId: accepted.operation_id },
    });
    if (prior) {
      if (
        prior.validationId !== validationId ||
        prior.qualificationId !== qualificationId ||
        prior.acceptedSha256 !== checksumBuffer(bytes)
      )
        throw new PdfPublicationError('PDF_PUBLICATION_CONFLICT');
      return prior;
    }
    const scope = await candidateAuthority(tx, accepted.operation_id);
    const v = await tx.pdfCandidateValidation.findUniqueOrThrow({
      where: { id: validationId },
      include: { review: true },
    });
    assertValidationScope(v, scope);
    assertReviewClearance(v, v.review);
    const q = await requireReaderQualification(tx, qualificationId, required);
    if (
      q.reportSha256 !== accepted.capability_report_sha256 ||
      q.readerBuildFingerprint !== accepted.reader_build_fingerprint ||
      q.adapterFingerprint !== accepted.adapter_fingerprint ||
      v.finalContentId !== accepted.final_content_id
    )
      throw new PdfPublicationError('PDF_READER_NOT_QUALIFIED');
    const artifacts = await tx.pdfArtifact.findMany({
      where: { operationId: scope.op.id },
    });
    const freshBytes = Buffer.from(
      JSON.stringify(acceptedManifest(scope.op, v, q, artifacts)),
    );
    if (
      !freshBytes.equals(bytes) ||
      JSON.stringify(accepted) !== bytes.toString('utf8')
    )
      throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
    await assertPublicationProviderClearance(tx, scope.op.id);
    await promotePublicationArtifacts(tx, accepted);
    const publication = await tx.pdfPublication.create({
      data: {
        operationId: scope.op.id,
        validationId,
        qualificationId,
        finalContentId: v.finalContentId,
        sourceArtifactId: accepted.source.id,
        canonicalArtifactId: v.canonicalArtifactId,
        epubArtifactId: v.epubArtifactId,
        readerArtifactId: v.readerArtifactId,
        reportArtifactId: v.reportArtifactId,
        resourceMap: v.resourceMap!,
        acceptedBytes: toPrismaBytes(bytes),
        acceptedSha256: checksumBuffer(bytes),
        publicationFence: v.attemptFence,
        generation: v.generation,
        cancellationEpoch: v.cancellationEpoch,
      },
    });
    await bindPublishedCover(tx, scope.op.bookId, accepted, v.resourceMap);
    await installPublishedFiles(tx, scope, v);
    const work = finishWork?.();
    await recordOperationEvent(
      tx,
      scope.op.id,
      `publication:${publication.id}`,
      {
        kind: 'PUBLISHED',
        stage: 'COMPLETE',
        severity: 'INFO',
        attemptId: v.attemptId,
        attemptFence: v.attemptFence,
        generation: v.generation,
        cancellationEpoch: v.cancellationEpoch,
        ...workEventTiming(work),
        details: {
          ...workEventDetails(work),
          outcome: 'COMPLETED',
          workerObservation: { status: 'UNOBSERVED', reason: 'UNAVAILABLE' },
          publicationId: publication.id,
          validationId,
          finalContentId: v.finalContentId,
        },
      },
      { status: 'READY', stage: 'COMPLETE', finalContentId: v.finalContentId },
      true,
    );
    return publication;
  });
}
