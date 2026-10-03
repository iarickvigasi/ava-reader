import type { SelectionAuthority } from './selection-authority';

export const selectionRefusals: ((authority: SelectionAuthority) => void)[] = [
  (a) => {
    a.viewer.ownerId = 'other';
  },
  (a) => {
    a.operation.deletedAt = new Date();
  },
  (a) => {
    a.operation.sourceSha256 = 'f'.repeat(64);
  },
  (a) => {
    a.operation.cancellationEpoch++;
  },
  (a) => {
    a.operation.sourceArtifactId = 'other';
  },
  (a) => {
    a.publication.fence++;
  },
  (a) => {
    a.capability.qualified = false;
  },
  (a) => {
    a.capability.adapterFingerprint = 'f'.repeat(64);
  },
  (a) => {
    a.capability.reportSha256 = 'f'.repeat(64);
  },
  (a) => {
    a.capability.readerBuildFingerprint = 'f'.repeat(64);
  },
  (a) => {
    a.capability.versions = [2];
  },
];
