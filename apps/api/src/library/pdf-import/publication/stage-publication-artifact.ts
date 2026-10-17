import { BlobPurpose, type PdfArtifactRole } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../../shared/blob-utils';
import { PdfPublicationError } from './errors';
export function stagePublicationArtifact(
  prisma: PrismaService,
  ownerId: string,
  role: PdfArtifactRole,
  bytes: Buffer,
) {
  if (
    !['DERIVED_READER', 'VALIDATION_REPORT'].includes(role) ||
    !bytes.length ||
    bytes.length > 32 * 1024 * 1024
  )
    throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
  const checksum = checksumBuffer(bytes);
  return prisma.pdfArtifact.create({
    data: {
      owner: { connect: { id: ownerId } },
      role,
      retention: 'STAGING',
      expiresAt: new Date(Date.now() + 3600000),
      checksum,
      sizeBytes: bytes.length,
      mimeType: 'application/json',
      blob: {
        create: {
          purpose: BlobPurpose.PDF_ARTIFACT,
          bytes: toPrismaBytes(bytes),
          checksum,
          sizeBytes: bytes.length,
          mimeType: 'application/json',
          originalFilename: role.toLowerCase() + '.json',
        },
      },
    },
  });
}
