import type {
  PdfArtifact,
  PdfCandidateValidation,
  PdfImportOperation,
  PdfReaderQualification,
} from '@prisma/client';
import type {
  AcceptedContentV1,
  Artifact,
} from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';
import { PdfPublicationError } from './errors';
export function acceptedManifest(
  op: PdfImportOperation,
  v: PdfCandidateValidation,
  q: PdfReaderQualification,
  artifacts: PdfArtifact[],
): AcceptedContentV1 {
  const descriptor = (
    id: string,
    role: Artifact['role'],
    path: string,
  ): Artifact => {
    const a = artifacts.find((a) => a.id === id);
    if (
      !a ||
      a.ownerId !== op.ownerId ||
      a.operationId !== op.id ||
      a.role !== role ||
      a.retention !== 'OPERATION'
    )
      throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
    const formats = {
      SOURCE_PDF: 'PDF',
      CANONICAL_BOOK: 'CANONICAL_JSON',
      DERIVED_READER: 'READER_PACKAGE',
      DERIVED_EPUB: 'EPUB',
      VALIDATION_REPORT: 'REPORT_JSON',
      RESOURCE: 'IMAGE',
      DIAGNOSTIC: 'REPORT_JSON',
    } as const;
    return {
      id: a.id,
      role,
      format: formats[role],
      media_type: a.mimeType as Artifact['media_type'],
      path,
      sha256: a.checksum,
      byte_length: a.sizeBytes,
    };
  };
  const map = v.resourceMap;
  if (
    !map ||
    typeof map !== 'object' ||
    Array.isArray(map) ||
    Object.values(map).some((id) => typeof id !== 'string')
  )
    throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
  return {
    schema_version: 'ava-accepted-content-1',
    authority: 'server_first_publication',
    operation_id: op.id,
    owner_id: op.ownerId,
    library_item_id: op.libraryItemId,
    final_content_id: v.finalContentId,
    profile_id: 'ava-pdf-prose-en-v2',
    canonical_schema: 'ava-book-2',
    reader_schema: 'ava-reader-3',
    config_sha256: op.configSha256,
    capability_report_sha256: q.reportSha256,
    adapter_fingerprint: q.adapterFingerprint,
    reader_build_fingerprint: q.readerBuildFingerprint,
    publication_fence: v.attemptFence,
    cancellation_epoch: op.cancellationEpoch,
    source: descriptor(op.sourceArtifactId, 'SOURCE_PDF', 'source.pdf'),
    canonical_book: descriptor(
      v.canonicalArtifactId,
      'CANONICAL_BOOK',
      'canonical.json',
    ),
    reader_package: descriptor(
      v.readerArtifactId,
      'DERIVED_READER',
      'reader.json',
    ),
    epub: descriptor(v.epubArtifactId, 'DERIVED_EPUB', 'book.epub'),
    validation_report: descriptor(
      v.reportArtifactId,
      'VALIDATION_REPORT',
      'publication-report.json',
    ),
    resources: Object.entries(map).map(([id, a]) =>
      descriptor(a as string, 'RESOURCE', `resources/${id}.image`),
    ),
  };
}
