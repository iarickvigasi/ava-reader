import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction, lockLibraryItem } from '../jobs/transaction';
import { grantPdfProvider } from './grant';
import { PdfProviderError } from './errors';
// Test-only setup. Product enqueue remains native until explicitly qualified activation.
export async function attachTestProviderGrant(
  prisma: PrismaService,
  operationId: string,
  routeId: string,
) {
  if (process.env.NODE_ENV !== 'test' || process.env.AVA_PDF_TEST_HOOKS !== '1')
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  return jobTransaction(prisma, async (tx) => {
    const op = await tx.pdfImportOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    await lockLibraryItem(tx, op.libraryItemId);
    const job = await tx.pdfConversionJob.findUniqueOrThrow({
        where: { operationId },
      }),
      route = await tx.pdfProviderRoute.findUniqueOrThrow({
        where: { id: routeId },
      });
    if (
      job.state !== 'QUEUED' ||
      job.attemptCount !== 0 ||
      job.dispatchAuthorizationId ||
      !['stub', 'replay'].includes(route.mode) ||
      route.mode !== job.providerMode
    )
      throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
    const grant = await grantPdfProvider(tx, op, routeId);
    await tx.pdfConversionJob.update({
      where: { id: job.id },
      data: { dispatchAuthorizationId: grant.id },
    });
    return { grantId: grant.id };
  });
}
