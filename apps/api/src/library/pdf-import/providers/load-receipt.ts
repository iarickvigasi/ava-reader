import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority } from '../jobs';
import { jobTransaction } from '../jobs/transaction';
import { checksumBuffer } from '../../../shared/blob-utils';
import { loadProviderGrant } from './load-grant';
import { parseProviderReceipt } from './receipt';
import { PdfProviderError } from './errors';
export async function loadProviderReceipt(
  prisma: PrismaService,
  authority: AttemptAuthority,
  callId: string,
) {
  const scope = await jobTransaction(prisma, (tx) =>
    loadProviderGrant(tx, authority, false),
  );
  const call = await prisma.pdfProviderCall.findUnique({
    where: { id: callId },
    include: {
      payloads: { where: { kind: 'RESPONSE' }, include: { blob: true } },
    },
  });
  const payload = call?.payloads[0];
  if (
    !call ||
    call.grantId !== scope.grant.id ||
    call.state !== 'SETTLED' ||
    !payload ||
    payload.ownerId !== scope.job.owner_id
  )
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_UNAVAILABLE');
  const bytes = Buffer.from(payload.blob.bytes);
  if (
    bytes.length !== payload.sizeBytes ||
    checksumBuffer(bytes) !== payload.checksum ||
    payload.checksum !== call.receiptSha256
  )
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_INVALID');
  const receipt = parseProviderReceipt(bytes, scope.grant.route.modelId);
  if (
    receipt.actualNano !== call.actualNano ||
    receipt.generationId !== call.providerGenerationId ||
    !receipt.complete ||
    receipt.output === null ||
    call.failureCode
  )
    throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
  await jobTransaction(prisma, (tx) => loadProviderGrant(tx, authority, false));
  return {
    callId,
    generationId: receipt.generationId,
    output: receipt.output,
    actualNano: receipt.actualNano.toString(),
    reused: true,
  };
}
