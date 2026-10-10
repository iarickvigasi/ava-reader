import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { PdfJobError } from './errors';
import type { AttemptAuthority } from './types';
export async function loadPdfJobSource(
  prisma: PrismaService,
  authority: AttemptAuthority,
) {
  const credential = { ...authority };
  const { job } = await jobTransaction(prisma, (tx) =>
    requireAttempt(tx, credential),
  );
  const source = await prisma.pdfArtifact.findFirst({
    where: {
      id: job.source.id,
      operationId: job.operation_id,
      ownerId: job.owner_id,
      role: 'SOURCE_PDF',
    },
    include: { blob: true },
  });
  if (
    !source ||
    source.checksum !== job.source.sha256 ||
    source.sizeBytes !== job.source.byte_length ||
    source.blob.bytes.length !== job.source.byte_length
  )
    throw new PdfJobError('SOURCE_MISMATCH');
  const bytes = Buffer.from(source.blob.bytes);
  if (checksumBuffer(bytes) !== job.source.sha256)
    throw new PdfJobError('SOURCE_MISMATCH');
  await jobTransaction(prisma, (tx) => requireAttempt(tx, credential));
  return bytes;
}
