import { BlobPurpose, Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../../shared/blob-utils';
import { PdfProviderError } from './errors';
export async function storeProviderPayload(
  prisma: PrismaService,
  ownerId: string,
  callId: string,
  kind: string,
  bytes: Buffer,
) {
  if (
    !['REQUEST', 'RESPONSE', 'UNCONFIRMED'].includes(kind) ||
    !bytes.length ||
    bytes.length > 16 * 1024 * 1024
  )
    throw new PdfProviderError('PDF_PROVIDER_PAYLOAD_LIMIT');
  const checksum = checksumBuffer(bytes),
    key = { callId_kind: { callId, kind } };
  const previous = await prisma.pdfProviderPayload.findUnique({ where: key });
  if (previous) {
    if (previous.checksum !== checksum || previous.ownerId !== ownerId)
      throw new PdfProviderError('PDF_PROVIDER_PAYLOAD_CONFLICT');
    return previous;
  }
  try {
    return await prisma.pdfProviderPayload.create({
      data: {
        owner: { connect: { id: ownerId } },
        call: { connect: { id: callId } },
        kind,
        checksum,
        sizeBytes: bytes.length,
        blob: {
          create: {
            purpose: BlobPurpose.PDF_ARTIFACT,
            bytes: toPrismaBytes(bytes),
            checksum,
            sizeBytes: bytes.length,
            mimeType: 'application/json',
            originalFilename: 'provider-' + kind.toLowerCase() + '.json',
          },
        },
      },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    )
      throw error;
    const existing = await prisma.pdfProviderPayload.findUniqueOrThrow({
      where: key,
    });
    if (existing.checksum !== checksum || existing.ownerId !== ownerId)
      throw new PdfProviderError('PDF_PROVIDER_PAYLOAD_CONFLICT');
    return existing;
  }
}
