import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import type {
  AcceptedContentV1,
  Artifact,
} from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';
import { checksumBuffer } from '../../../shared/blob-utils';
import { PdfPublicationError } from './errors';

const projection = z.object({
  schema_version: z.literal('ava-publication-report-1'),
  cover_resource_id: z.string().min(1).max(200).nullable().optional(),
});

// Read only the small validator-owned projection, never a model URL or the whole canonical graph.
export async function bindPublishedCover(
  tx: Tx,
  bookId: string,
  accepted: AcceptedContentV1,
  resourceMap: Prisma.JsonValue,
) {
  const invalid = () =>
    new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
  const load = async (descriptor: Artifact, maximum: number) => {
    if (descriptor.byte_length > maximum) throw invalid();
    const artifact = await tx.pdfArtifact.findFirst({
      where: {
        id: descriptor.id,
        operationId: accepted.operation_id,
        ownerId: accepted.owner_id,
        role: descriptor.role,
        retention: 'ACCEPTED',
        checksum: descriptor.sha256,
        sizeBytes: descriptor.byte_length,
        mimeType: descriptor.media_type,
      },
      include: { blob: true },
    });
    if (!artifact) throw invalid();
    const bytes = Buffer.from(artifact.blob.bytes);
    if (
      bytes.length !== descriptor.byte_length ||
      artifact.blob.checksum !== descriptor.sha256 ||
      artifact.blob.sizeBytes !== bytes.length ||
      artifact.blob.mimeType !== descriptor.media_type ||
      checksumBuffer(bytes) !== descriptor.sha256
    )
      throw invalid();
    return { artifact, bytes };
  };
  const report = await load(accepted.validation_report, 16 * 1024 ** 2);
  let parsed: z.infer<typeof projection>;
  try {
    parsed = projection.parse(JSON.parse(report.bytes.toString('utf8')));
  } catch {
    throw invalid();
  }
  // Older validated reports without a declared cover retain their existing behavior.
  if (!parsed.cover_resource_id) return;
  if (
    !resourceMap ||
    typeof resourceMap !== 'object' ||
    Array.isArray(resourceMap)
  )
    throw invalid();
  const id = resourceMap[parsed.cover_resource_id];
  const descriptor = accepted.resources.find((r) => r.id === id);
  if (
    !descriptor ||
    descriptor.role !== 'RESOURCE' ||
    !['image/png', 'image/jpeg'].includes(descriptor.media_type)
  )
    throw invalid();
  const cover = await load(descriptor, 32 * 1024 ** 2);
  const changed = await tx.book.updateMany({
    where: { id: bookId, pdfImportPrivate: true, coverBlobId: null },
    data: { coverBlobId: cover.artifact.blobId },
  });
  if (changed.count !== 1) throw invalid();
}
