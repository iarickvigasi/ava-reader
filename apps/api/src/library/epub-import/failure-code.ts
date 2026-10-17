import { ContractError } from '../../pdf-conversion/contracts/contract-error';
import { PdfRuntimeError } from '../../pdf-conversion/runtime/runtime-error';
import {
  EpubLeaseExpired,
  EpubHeartbeatUnavailable,
  InvalidImportedEpub,
} from './errors';
import { PdfPublicationError } from '../pdf-import/publication/errors';
export function epubFailureCode(error: unknown, activation = false) {
  if (error instanceof EpubLeaseExpired) return 'LEASE_EXPIRED';
  if (error instanceof EpubHeartbeatUnavailable) return 'HEARTBEAT_UNAVAILABLE';
  if (error instanceof PdfPublicationError) return 'READER_NOT_QUALIFIED';
  if (
    error instanceof Error &&
    error.message === 'EPUB_ACTIVATION_NOT_CONFIGURED'
  )
    return 'ACTIVATION_NOT_CONFIGURED';
  if (error instanceof InvalidImportedEpub) return 'INVALID_EPUB';
  if (error instanceof ContractError)
    return error.code === 'VALIDATOR_UNAVAILABLE'
      ? 'SEMANTIC_UNAVAILABLE'
      : 'INVALID_PREPARED_EPUB';
  if (error instanceof PdfRuntimeError) return error.code;
  if (error instanceof Error) {
    switch (error.message) {
      case 'EPUB_IMPORT_CONTENT_CHANGED':
        return 'PREPARED_CONTENT_CHANGED';
      case 'EPUB_PREPARATION_FAILED':
        return 'PREPARATION_INVALID';
      case 'EPUB_IMPORT_SOURCE_CHANGED':
        return 'SOURCE_CHANGED';
      case 'EPUB_IMPORT_ACTIVATION_CONFLICT':
        return 'ACTIVATION_CONFLICT';
      case 'EPUB_IMPORT_AUTHORITY_INVALID':
        return 'CLAIM_AUTHORITY_INVALID';
      case 'EPUB_VALIDATOR_UNAVAILABLE':
        return 'VALIDATOR_UNAVAILABLE';
      case 'EPUB_IMPORT_INVALID_RECEIPT':
        return 'INVALID_RECEIPT';
    }
  }
  return activation ? 'ACTIVATION_UNAVAILABLE' : 'PREPARATION_UNAVAILABLE';
}
export function permanentEpubFailure(error: unknown) {
  return [
    'INVALID_EPUB',
    'INVALID_PREPARED_EPUB',
    'PREPARED_CONTENT_CHANGED',
    'PREPARATION_INVALID',
    'SOURCE_CHANGED',
    'INVALID_RECEIPT',
  ].includes(epubFailureCode(error));
}
