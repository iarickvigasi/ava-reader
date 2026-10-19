import { fixtureBytes } from '../../../pdf-conversion/contracts/contract-fixtures';
import { validateStructure } from '../../../pdf-conversion/contracts/validate-structure';
import { checksumBuffer } from '../../../shared/blob-utils';
import type {
  OwnedReaderArtifact,
  SelectionAuthority,
} from './selection-authority';

// Unit-test authority only: no live publication row or readiness claim is created.
export function selectionFixture() {
  const readerBytes = fixtureBytes('ava-reader-3');
  const reader = validateStructure(
    'ava-reader-3',
    JSON.parse(readerBytes.toString()) as unknown,
  );
  const accepted = validateStructure(
    'ava-accepted-content-1',
    JSON.parse(fixtureBytes('ava-accepted-content-1').toString()) as unknown,
  );
  accepted.final_content_id = reader.final_content_id;
  accepted.source.byte_length = reader.book.source.byte_length;
  accepted.reader_package.sha256 = checksumBuffer(readerBytes);
  accepted.reader_package.byte_length = readerBytes.length;
  const acceptedBytes = Buffer.from(JSON.stringify(accepted));
  const authority: SelectionAuthority = {
    viewer: {
      ownerId: accepted.owner_id,
      libraryItemId: accepted.library_item_id,
    },
    publication: {
      acceptedSha256: checksumBuffer(acceptedBytes),
      fence: accepted.publication_fence,
    },
    operation: {
      id: accepted.operation_id,
      ownerId: accepted.owner_id,
      libraryItemId: accepted.library_item_id,
      status: 'READY',
      deletedAt: null,
      finalContentId: accepted.final_content_id,
      sourceArtifactId: accepted.source.id,
      sourceSha256: accepted.source.sha256,
      configSha256: accepted.config_sha256,
      cancellationEpoch: accepted.cancellation_epoch,
    },
    capability: {
      qualified: true,
      adapterFingerprint: accepted.adapter_fingerprint,
      readerBuildFingerprint: accepted.reader_build_fingerprint,
      reportSha256: accepted.capability_report_sha256,
      versions: [3],
      capabilities: reader.required_capabilities,
    },
  };
  const artifact: OwnedReaderArtifact = {
    id: accepted.reader_package.id,
    ownerId: accepted.owner_id,
    operationId: accepted.operation_id,
    role: 'DERIVED_READER',
    retention: 'ACCEPTED',
    checksum: accepted.reader_package.sha256,
    sizeBytes: readerBytes.length,
    mimeType: 'application/json',
    bytes: readerBytes,
  };
  return { acceptedBytes, authority, artifact };
}
