import type { Tx } from '../jobs/types';
import { requireAttempt } from '../jobs/authority';
import type { AttemptAuthority } from '../jobs';
import { PdfProviderError } from './errors';
import { routePolicy } from './route-policy';
import { requirePilotOperation } from './pilot-authority';
export async function loadProviderGrant(
  tx: Tx,
  authority: AttemptAuthority,
  requireActive = true,
) {
  const scope = await requireAttempt(tx, authority),
    id = scope.attempt.job.dispatchAuthorizationId;
  if (!id) throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  const grant = await tx.pdfProviderGrant.findUnique({
    where: { id },
    include: { route: true },
  });
  if (
    !grant ||
    grant.operationId !== scope.job.operation_id ||
    grant.operationKey !== scope.job.operation_id ||
    grant.ownerId !== scope.job.owner_id ||
    grant.sourceSha256 !== scope.job.source.sha256 ||
    grant.configSha256 !== scope.job.config_sha256 ||
    (scope.job.provider_mode === 'live' &&
      scope.job.dispatch_authority_id !== id) ||
    grant.route.mode !== scope.job.provider_mode ||
    grant.state === 'REVOKED' ||
    grant.route.state === 'REVOKED'
  )
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  if (
    requireActive &&
    (grant.state !== 'ACTIVE' ||
      grant.route.state !== 'ACTIVE' ||
      grant.route.verifiedAt > scope.now ||
      grant.route.validUntil <= scope.now)
  )
    throw new PdfProviderError('PDF_PROVIDER_ROUTE_UNAVAILABLE');
  const { config } = routePolicy(grant.route.configuration, grant.route.tariff);
  requirePilotOperation(
    config,
    grant.route.mode,
    {
      operationId: scope.job.operation_id,
      ownerId: scope.job.owner_id,
      sourceSha256: scope.job.source.sha256,
    },
    scope.job.worker_fingerprint,
  );
  return { ...scope, grant };
}
