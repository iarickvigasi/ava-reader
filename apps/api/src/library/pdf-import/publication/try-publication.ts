import type { PrismaService } from '../../../prisma/prisma.service';
import type { WorkerCredential } from '../jobs/types';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { publishPdfCandidate } from './publish';
import { PdfPublicationError } from './errors';
export async function tryPublication(
  prisma: PrismaService,
  operationId: string,
  validationId: string,
  qualificationId: string | undefined,
  semantic: SemanticValidator,
  credential: WorkerCredential,
) {
  if (!qualificationId)
    return {
      kind: 'waiting_reader' as const,
      operationId: operationId,
    };
  try {
    const publication = await publishPdfCandidate(
      prisma,
      validationId,
      qualificationId,
      semantic,
      credential,
    );
    return {
      kind: 'ready' as const,
      operationId: operationId,
      finalContentId: publication.finalContentId,
    };
  } catch (error) {
    if (
      error instanceof PdfPublicationError &&
      error.code === 'PDF_PUBLICATION_REVIEW_REQUIRED'
    )
      return { kind: 'waiting_review' as const, operationId };
    if (
      error instanceof PdfPublicationError &&
      error.code === 'PDF_READER_NOT_QUALIFIED'
    )
      return { kind: 'waiting_reader' as const, operationId };
    throw error;
  }
}
