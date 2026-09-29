import type { WorkerCredential } from '../jobs/types';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import { jobTransaction } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { assertValidationScope } from './validation-scope';
import { requireReaderQualification } from './qualification';
import { acceptedManifest } from './accepted-manifest';
import { commitPublication } from './commit-publication';
import { PdfPublicationError } from './errors';
export async function publishPdfCandidate(
  prisma: PrismaService,
  validationId: string,
  qualificationId: string,
  semantic: SemanticValidator,
  credential?: WorkerCredential,
) {
  const v = await prisma.pdfCandidateValidation.findUniqueOrThrow({
    where: { id: validationId },
  });
  const prior = await prisma.pdfPublication.findUnique({
    where: { operationId: v.operationId },
    include: { operation: true },
  });
  if (prior) {
    if (
      prior.validationId !== validationId ||
      prior.qualificationId !== qualificationId ||
      prior.operation.deletedAt ||
      prior.operation.status !== 'READY'
    )
      throw new PdfPublicationError('PDF_PUBLICATION_CONFLICT');
    return prior;
  }
  const scope = await jobTransaction(prisma, (tx) =>
    candidateAuthority(tx, v.operationId),
  );
  assertValidationScope(v, scope);
  const readerArtifact = await prisma.pdfArtifact.findUniqueOrThrow({
    where: { id: v.readerArtifactId },
    include: { blob: true },
  });
  const reader = await validateContract(
    'ava-reader-3',
    Buffer.from(readerArtifact.blob.bytes),
    semantic,
  );
  if (
    reader.final_content_id !== v.finalContentId ||
    reader.canonical_sha256 !== v.canonicalDigest
  )
    throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
  const q = await requireReaderQualification(
    prisma,
    qualificationId,
    reader.required_capabilities,
  );
  const artifacts = await prisma.pdfArtifact.findMany({
    where: { operationId: scope.op.id },
  });
  const accepted = acceptedManifest(scope.op, v, q, artifacts),
    bytes = Buffer.from(JSON.stringify(accepted));
  await validateContract('ava-accepted-content-1', bytes, semantic);
  return commitPublication(
    prisma,
    validationId,
    qualificationId,
    accepted,
    bytes,
    reader.required_capabilities,
    credential,
  );
}
