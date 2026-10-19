import type { WorkerResultV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-worker-result-1';
import { checksumBuffer } from '../../../shared/blob-utils';
import { PdfJobError } from './errors';
import { ARTIFACT_BYTE_LIMIT } from './policy';
export type ArtifactBytes = { id: string; bytes: Buffer };
export function resultArtifacts(result: WorkerResultV1) {
  const outcome = result.outcome;
  return outcome.status === 'candidate'
    ? [
        outcome.canonical_book,
        outcome.epub,
        outcome.validation_report,
        ...outcome.resources,
      ]
    : [outcome.diagnostic];
}
export function snapshotArtifactBytes(artifacts: ArtifactBytes[]) {
  if (!Array.isArray(artifacts) || artifacts.length > 1003)
    throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  let total = 0;
  const ids = new Set<string>();
  for (const artifact of artifacts) {
    if (
      !artifact ||
      typeof artifact.id !== 'string' ||
      ids.has(artifact.id) ||
      !Buffer.isBuffer(artifact.bytes) ||
      !artifact.bytes.length
    )
      throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
    ids.add(artifact.id);
    total += artifact.bytes.length;
    if (total > ARTIFACT_BYTE_LIMIT)
      throw new PdfJobError('PDF_JOB_ARTIFACT_LIMIT');
  }
  return artifacts.map((artifact) => ({
    id: artifact.id,
    bytes: Buffer.from(artifact.bytes),
  }));
}
export function validateArtifactBytes(
  result: WorkerResultV1,
  artifacts: ArtifactBytes[],
) {
  const descriptors = resultArtifacts(result);
  if (descriptors.length !== artifacts.length)
    throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  for (const descriptor of descriptors) {
    const artifact = artifacts.find((value) => value.id === descriptor.id);
    if (
      !artifact ||
      artifact.bytes.length !== descriptor.byte_length ||
      checksumBuffer(artifact.bytes) !== descriptor.sha256
    )
      throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  }
}
