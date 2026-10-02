import type { PrismaService } from '../../../prisma/prisma.service';
import type { ProviderDispatch, ProviderTransport } from './types';
import { reservePdfProvider } from './reserve';
import { storeProviderPayload } from './payload';
import { beginPdfDispatch } from './begin-dispatch';
import { settlePdfProvider } from './settle';
import { markPdfProviderUncertain } from './uncertain';
import { loadProviderReceipt } from './load-receipt';
import { openRouterTransport } from './openrouter-transport';
import { preserveUnconfirmedReceipt } from './unconfirmed-receipt';
import { PdfProviderError } from './errors';
import {
  privateTransportReceipt,
  providerFailureDiagnostic,
} from './transport-failure';
export async function dispatchPdfProvider(
  prisma: PrismaService,
  input: ProviderDispatch,
  testTransport?: ProviderTransport,
) {
  const authority = { ...input.authority };
  const { call, prepared, grant } = await reservePdfProvider(
    prisma,
    authority,
    input.task,
  );
  if (call.state === 'SETTLED')
    return loadProviderReceipt(prisma, authority, call.id);
  if (
    call.state === 'DISPATCHING' &&
    call.dispatchAttemptId === authority.attemptId
  )
    throw new PdfProviderError('PDF_PROVIDER_CALL_IN_PROGRESS');
  if (['DISPATCHING', 'UNCERTAIN'].includes(call.state)) {
    await markPdfProviderUncertain(prisma, call.id);
    throw new PdfProviderError('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  }
  if (call.state !== 'RESERVED')
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_RELEASED');
  const testing = grant.route.mode !== 'live';
  if (
    testing &&
    (process.env.NODE_ENV !== 'test' ||
      process.env.AVA_PDF_TEST_HOOKS !== '1' ||
      !testTransport)
  )
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  if (!testing && (testTransport || !process.env.OPENROUTER_API_KEY))
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  await storeProviderPayload(
    prisma,
    grant.ownerId,
    call.id,
    'REQUEST',
    prepared.request,
  );
  if (input.signal?.aborted)
    throw new PdfProviderError('PDF_PROVIDER_NOT_DISPATCHED');
  await beginPdfDispatch(prisma, authority, call.id);
  let response: Buffer | undefined;
  try {
    response = await (testing ? testTransport! : openRouterTransport)({
      request: prepared.request,
      apiKey: testing ? '' : process.env.OPENROUTER_API_KEY!,
      timeoutMs: prepared.config.timeoutMs,
      maxResponseBytes: prepared.config.maxResponseBytes,
      signal: input.signal,
    });
    await settlePdfProvider(prisma, call.id, response);
  } catch (error) {
    response ??= privateTransportReceipt(error);
    const diagnostic = providerFailureDiagnostic(error);
    if (diagnostic) await markPdfProviderUncertain(prisma, call.id, diagnostic);
    else await markPdfProviderUncertain(prisma, call.id);
    await preserveUnconfirmedReceipt(prisma, grant.ownerId, call.id, response);
    throw new PdfProviderError('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  }
  // Charge settlement survives owner deletion; private payload does not.
  if (
    !(await prisma.user.findUnique({
      where: { id: grant.ownerId },
      select: { id: true },
    }))
  )
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_UNAVAILABLE');
  await storeProviderPayload(
    prisma,
    grant.ownerId,
    call.id,
    'RESPONSE',
    response,
  );
  const receipt = await loadProviderReceipt(prisma, authority, call.id);
  return { ...receipt, reused: false };
}
