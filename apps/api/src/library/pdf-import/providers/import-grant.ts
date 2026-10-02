import type { Tx } from '../jobs/types';
import { grantPdfProvider } from './grant';
import { routePolicy } from './route-policy';
import { PdfProviderError } from './errors';
export async function grantConfiguredImport(
  tx: Tx,
  operationId: string,
  ownerId: string,
) {
  const routeId = process.env.AVA_PDF_PROVIDER_ROUTE_ID;
  if (!routeId) throw new PdfProviderError('PDF_PROVIDER_ROUTE_UNAVAILABLE');
  const route = await tx.pdfProviderRoute.findUnique({
    where: { id: routeId },
  });
  if (
    !route ||
    route.mode !== 'live' ||
    !routePolicy(route.configuration, route.tariff).config.importPolicy
  )
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_UNAUTHORIZED');
  const op = await tx.pdfImportOperation.findUniqueOrThrow({
    where: { id: operationId },
  });
  if (op.ownerId !== ownerId)
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_UNAUTHORIZED');
  const grant = await grantPdfProvider(tx, op, routeId);
  return {
    dispatchAuthorizationId: grant.id,
    workerFingerprint: routePolicy(route.configuration, route.tariff).config
      .importPolicy!.workerFingerprint,
  };
}
