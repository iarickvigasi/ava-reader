import { JobAuthorityError } from '../jobs/errors';
import { PdfPublicationError } from './errors';
import { ContractError } from '../../../pdf-conversion/contracts/contract-error';
export function publicationFailureKind(
  error: unknown,
): 'content' | 'infrastructure' | 'authority' {
  if (error instanceof JobAuthorityError) return 'authority';
  if (error instanceof ContractError)
    return error.code === 'INVALID_CONTRACT' ? 'content' : 'infrastructure';
  if (error instanceof PdfPublicationError) {
    if (
      [
        'PDF_EPUB_VALIDATION_FAILED',
        'PDF_CANONICAL_CONSERVATION_FAILED',
        'PDF_SOURCE_REPORT_INVALID',
        'PDF_CANDIDATE_NOT_QUALIFIED',
        'PDF_CANDIDATE_ARTIFACT_INVALID',
        'PDF_PUBLICATION_HARD_BLOCKED',
      ].includes(error.code)
    )
      return 'content';
    if (
      [
        'PDF_PUBLICATION_AUTHORITY_INVALID',
        'PDF_PUBLICATION_UNAVAILABLE',
        'PDF_VALIDATION_STALE',
        'PDF_VALIDATION_AUTHORITY_INVALID',
      ].includes(error.code)
    )
      return 'authority';
  }
  return 'infrastructure';
}
