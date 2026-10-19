import type { RouteConfiguration } from './types';
import { requirePilotOperation } from './pilot-authority';
import { PdfProviderError } from './errors';
export function requireRouteOperation(
  config: RouteConfiguration,
  mode: string,
  scope: {
    operationId: string;
    ownerId: string;
    sourceSha256: string;
    profileId: string;
    configSha256: string;
  },
  workerFingerprint?: string,
) {
  if (!config.importPolicy)
    return requirePilotOperation(config, mode, scope, workerFingerprint);
  const policy = config.importPolicy;
  if (
    mode !== 'live' ||
    !scope.operationId ||
    !scope.ownerId ||
    !/^[a-f0-9]{64}$/.test(scope.sourceSha256) ||
    scope.profileId !== policy.profileId ||
    scope.configSha256 !== policy.configSha256 ||
    (workerFingerprint !== undefined &&
      workerFingerprint !== policy.workerFingerprint)
  )
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_UNAUTHORIZED');
}
