import type { Tx } from '../../jobs/types';
import { databaseNow } from '../../jobs/transaction';
import { routePolicy } from '../route-policy';
import { PdfProviderError } from '../errors';
import { PILOT_IMAGE, PILOT_SOURCES, requirePilotOperator } from './scope';
export async function loadAuthoredPilotRoute(tx: Tx, routeId: string) {
  requirePilotOperator();
  const [database] = await tx.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  if (database.name !== 'ava_pdf_authored_pilot')
    throw new PdfProviderError('PDF_PILOT_DISABLED');
  const route = await tx.pdfProviderRoute.findUnique({
      where: { id: routeId },
    }),
    now = await databaseNow(tx);
  if (
    !route ||
    route.mode !== 'live' ||
    route.state !== 'ACTIVE' ||
    route.modelId !== 'google/gemini-3.8-flash' ||
    route.providerSlug !== 'google-vertex/global/priority' ||
    route.verifiedAt > now ||
    route.validUntil <= now
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
  const { config, maximumNano } = routePolicy(
      route.configuration,
      route.tariff,
    ),
    pilot = config.pilotInventory;
  if (
    !pilot ||
    pilot.workerFingerprint !== PILOT_IMAGE ||
    pilot.maxRequests !== 3 ||
    maximumNano !== 199066950n ||
    pilot.operations.length !== 1 ||
    config.timeoutMs !== 300000 ||
    PILOT_SOURCES.some((s) => {
      const op = pilot.operations.find((o) => o.sourceSha256 === s);
      return !op || op.tasks.length !== 3;
    })
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
  return { route, config, pilot };
}
