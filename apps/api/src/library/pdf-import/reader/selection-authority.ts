import { ConflictException } from '@nestjs/common';
import type { AcceptedContentV1 } from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';

// PDF-09 must load these from trusted publication and capability records, never a request.
export type SelectionAuthority = {
  viewer: { ownerId: string; libraryItemId: string };
  publication: { acceptedSha256: string; fence: number };
  operation: {
    id: string;
    ownerId: string;
    libraryItemId: string;
    status: string;
    deletedAt: Date | null;
    finalContentId: string | null;
    sourceArtifactId: string;
    sourceSha256: string;
    configSha256: string;
    cancellationEpoch: number;
  };
  capability: {
    qualified: boolean;
    adapterFingerprint: string;
    readerBuildFingerprint: string;
    reportSha256: string;
    versions: number[];
    capabilities: string[];
  };
};
export function assertSelectionAuthority(
  accepted: AcceptedContentV1,
  expected: SelectionAuthority,
) {
  const { operation: op, publication, capability } = expected;
  if (
    !expected.viewer ||
    accepted.owner_id !== expected.viewer.ownerId ||
    accepted.library_item_id !== expected.viewer.libraryItemId ||
    !op ||
    !publication ||
    !capability ||
    op.deletedAt !== null ||
    op.status !== 'READY' ||
    !op.finalContentId ||
    !capability.qualified ||
    !Array.isArray(capability.versions) ||
    !capability.versions.includes(3) ||
    !Array.isArray(capability.capabilities) ||
    accepted.owner_id !== op.ownerId ||
    accepted.operation_id !== op.id ||
    accepted.library_item_id !== op.libraryItemId ||
    accepted.final_content_id !== op.finalContentId ||
    accepted.source.id !== op.sourceArtifactId ||
    accepted.source.sha256 !== op.sourceSha256 ||
    accepted.config_sha256 !== op.configSha256 ||
    accepted.cancellation_epoch !== op.cancellationEpoch ||
    accepted.publication_fence !== publication.fence ||
    accepted.adapter_fingerprint !== capability.adapterFingerprint ||
    accepted.reader_build_fingerprint !== capability.readerBuildFingerprint ||
    accepted.capability_report_sha256 !== capability.reportSha256
  )
    throw new ConflictException('Accepted PDF reader is unavailable.');
}

export type OwnedReaderArtifact = {
  id: string;
  ownerId: string;
  operationId: string;
  role: string;
  retention: string;
  checksum: string;
  sizeBytes: number;
  mimeType: string;
  bytes: Uint8Array;
};
