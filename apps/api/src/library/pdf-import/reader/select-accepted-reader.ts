import { ConflictException } from '@nestjs/common';
import { checksumBuffer } from '../../../shared/blob-utils';
import {
  acceptedReaderValidationCache,
  type ReaderSemanticValidator,
  type ReaderValidationCache,
} from './reader-validation-cache';
import {
  assertSelectionAuthority,
  type OwnedReaderArtifact,
  type SelectionAuthority,
} from './selection-authority';

// ReaderService reaches this through immutable publication and qualified-consumer checks.
// Canonical-file and embedded-book digests use different serialization domains.
// Conservation is the publisher's obligation, bound here by accepted reader bytes.
export async function selectAcceptedPdfReader(input: {
  acceptedBytes: Buffer;
  authority: SelectionAuthority;
  semantic: ReaderSemanticValidator;
  validationCache?: ReaderValidationCache;
  loadOwnedArtifact: (id: string) => Promise<OwnedReaderArtifact | null>;
}) {
  const { semantic, loadOwnedArtifact } = input;
  const cache = input.validationCache ?? acceptedReaderValidationCache;
  const bytes = Buffer.from(input.acceptedBytes);
  const expected = structuredClone(input.authority);
  const acceptedSha256 = checksumBuffer(bytes);
  if (
    !expected?.publication ||
    acceptedSha256 !== expected.publication.acceptedSha256
  )
    throw new ConflictException('Accepted PDF reader is unavailable.');
  const scope = {
    adapterFingerprint: expected.capability?.adapterFingerprint,
    readerBuildFingerprint: expected.capability?.readerBuildFingerprint,
  };
  const accepted = await cache.validate(
    'ava-accepted-content-1',
    bytes,
    semantic,
    {
      ...scope,
      actualSha256: acceptedSha256,
      byteLength: bytes.length,
    },
  );
  assertSelectionAuthority(accepted, expected);
  const artifact = await loadOwnedArtifact(accepted.reader_package.id);
  if (!artifact)
    throw new ConflictException('Accepted PDF reader is unavailable.');
  const readerBytes = Buffer.from(artifact.bytes);
  const descriptor = accepted.reader_package;
  const readerSha256 = checksumBuffer(readerBytes);
  if (
    artifact.id !== descriptor.id ||
    artifact.ownerId !== accepted.owner_id ||
    artifact.operationId !== accepted.operation_id ||
    artifact.role !== 'DERIVED_READER' ||
    artifact.retention !== 'ACCEPTED' ||
    artifact.mimeType !== descriptor.media_type ||
    artifact.sizeBytes !== descriptor.byte_length ||
    readerBytes.length !== descriptor.byte_length ||
    artifact.checksum !== descriptor.sha256 ||
    readerSha256 !== descriptor.sha256
  )
    throw new ConflictException('Accepted PDF reader is unavailable.');
  const reader = await cache.validate('ava-reader-3', readerBytes, semantic, {
    ...scope,
    actualSha256: readerSha256,
    byteLength: readerBytes.length,
  });
  if (
    reader.final_content_id !== accepted.final_content_id ||
    reader.book.source.sha256 !== accepted.source.sha256 ||
    reader.book.source.byte_length !== accepted.source.byte_length ||
    reader.required_capabilities.some(
      (value) => !expected.capability.capabilities.includes(value),
    )
  )
    throw new ConflictException('Accepted PDF reader is unavailable.');
  return {
    contentId: accepted.final_content_id,
    artifactId: descriptor.id,
    reader,
  };
}
