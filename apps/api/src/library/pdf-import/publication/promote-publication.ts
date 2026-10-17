import type { Tx } from '../jobs/types';
import type { AcceptedContentV1 } from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';
import { PdfPublicationError } from './errors';
export async function promotePublicationArtifacts(
  tx: Tx,
  accepted: AcceptedContentV1,
) {
  const retained = [
    accepted.canonical_book,
    accepted.reader_package,
    accepted.epub,
    accepted.validation_report,
    ...accepted.resources,
  ];
  for (const d of retained) {
    const changed = await tx.pdfArtifact.updateMany({
      where: {
        id: d.id,
        operationId: accepted.operation_id,
        ownerId: accepted.owner_id,
        retention: 'OPERATION',
        checksum: d.sha256,
        sizeBytes: d.byte_length,
        role: d.role,
      },
      data: { retention: 'ACCEPTED' },
    });
    if (changed.count !== 1)
      throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
  }
}
