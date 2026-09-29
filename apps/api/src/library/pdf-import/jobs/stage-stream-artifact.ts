import { BlobPurpose } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../../shared/blob-utils';
import type { StreamArtifact } from '../../../pdf-conversion/runtime/stream-schema';
import type { AttemptAuthority } from './types';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { PdfJobError } from './errors';
export async function stagePdfStreamArtifact(
  prisma: PrismaService,
  authority: AttemptAuthority,
  descriptor: StreamArtifact,
  bytes: Buffer,
) {
  const scope = await jobTransaction(prisma, (tx) =>
    requireAttempt(tx, { ...authority }),
  );
  const roles = {
    'canonical.json': ['CANONICAL_BOOK', 'application/json'],
    'book.epub': ['DERIVED_EPUB', 'application/epub+zip'],
    'reconstruction-report.json': ['VALIDATION_REPORT', 'application/json'],
  } as const;
  const role =
    roles[descriptor.path as keyof typeof roles] ??
    (/^(resources\/[A-Za-z0-9._/-]+\.(png|jpg|jpeg)|images\/[a-f0-9]{64}\.png)$/.test(
      descriptor.path,
    )
      ? [
          'RESOURCE',
          descriptor.path.endsWith('.png') ? 'image/png' : 'image/jpeg',
        ]
      : null);
  if (
    !role ||
    bytes.length !== descriptor.byte_length ||
    bytes.length > (role[0] === 'DERIVED_EPUB' ? 256 : 200) * 1024 ** 2 ||
    checksumBuffer(bytes) !== descriptor.sha256
  )
    throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  const artifact = await prisma.pdfArtifact.create({
    data: {
      owner: { connect: { id: scope.job.owner_id } },
      role: role[0],
      retention: 'STAGING',
      expiresAt: new Date(Date.now() + 3600000),
      checksum: descriptor.sha256,
      sizeBytes: bytes.length,
      mimeType: role[1],
      blob: {
        create: {
          purpose: BlobPurpose.PDF_ARTIFACT,
          bytes: toPrismaBytes(bytes),
          checksum: descriptor.sha256,
          sizeBytes: bytes.length,
          mimeType: role[1],
          originalFilename: descriptor.path.split('/').at(-1)!,
        },
      },
    },
  });
  return artifact.id;
}
