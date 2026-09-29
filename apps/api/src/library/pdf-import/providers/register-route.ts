import type { Prisma, PrismaClient } from '@prisma/client';
import { routePolicy } from './route-policy';
import { jsonHash } from './hash';
import { PdfProviderError } from './errors';
export async function registerPdfRoute(
  prisma: PrismaClient,
  input: {
    accountKey: string;
    modelId: string;
    providerSlug: string;
    mode: 'live' | 'stub' | 'replay';
    configuration: unknown;
    tariff: unknown;
    verifiedAt: string;
    validUntil: string;
  },
) {
  const spec = structuredClone(input),
    { config, tariff } = routePolicy(spec.configuration, spec.tariff);
  const verifiedAt = new Date(spec.verifiedAt),
    validUntil = new Date(spec.validUntil);
  if (
    !/^[A-Za-z0-9_.:-]{1,100}$/.test(spec.accountKey) ||
    !/^[A-Za-z0-9_.:/-]{1,160}$/.test(spec.modelId) ||
    !/^[A-Za-z0-9_.:/-]{1,100}$/.test(spec.providerSlug) ||
    !['live', 'stub', 'replay'].includes(spec.mode) ||
    (spec.mode === 'live' && !config.pilotInventory) ||
    !Number.isFinite(verifiedAt.getTime()) ||
    !Number.isFinite(validUntil.getTime()) ||
    validUntil <= verifiedAt ||
    validUntil.getTime() - verifiedAt.getTime() > 86400000 ||
    (spec.mode !== 'live' &&
      (process.env.NODE_ENV !== 'test' ||
        process.env.AVA_PDF_TEST_HOOKS !== '1'))
  )
    throw new PdfProviderError('PDF_PROVIDER_ROUTE_INVALID');
  const record = await prisma.pdfProviderRoute.create({
    data: {
      accountKey: spec.accountKey,
      modelId: spec.modelId,
      providerSlug: spec.providerSlug,
      mode: spec.mode,
      configuration: config as unknown as Prisma.InputJsonValue,
      configurationSha256: jsonHash(config),
      tariff: tariff as unknown as Prisma.InputJsonValue,
      tariffSha256: jsonHash(tariff),
      verifiedAt,
      validUntil,
    },
  });
  return {
    routeId: record.id,
    configurationSha256: record.configurationSha256,
  };
}
