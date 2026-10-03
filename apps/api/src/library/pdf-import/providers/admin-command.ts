import { resumeReconciledPdfJob } from './resume-job';
import type { PrismaService } from '../../../prisma/prisma.service';
import { adminBytes, adminJson, budgetInput, routeInput } from './admin-input';
import { registerPdfBudget } from './register-budget';
import { registerPdfRoute } from './register-route';
import { pdfProviderMetrics } from './metrics';
import {
  reconcilePdfProviderReceipt,
  reactivateReconciledPdfRoute,
} from './reconcile';
import { releaseUndispatchedPdfCall } from './release';
import { PdfProviderError } from './errors';
export async function runPdfProviderAdmin(
  prisma: PrismaService,
  args: string[],
) {
  const [command, id, file] = args;
  if (command === 'resume-reconciled' && args.length === 2)
    return resumeReconciledPdfJob(prisma, id);
  if (command === 'metrics' && args.length === 1)
    return pdfProviderMetrics(prisma);
  if (command === 'register-budget' && args.length === 2)
    return registerPdfBudget(prisma, budgetInput.parse(adminJson(id)));
  if (command === 'register-route' && args.length === 2) {
    const spec = routeInput.parse(adminJson(id));
    return registerPdfRoute(prisma, {
      ...spec,
      configuration: spec.configuration,
      tariff: spec.tariff,
    });
  }
  if (command === 'settle' && args.length === 3)
    return reconcilePdfProviderReceipt(prisma, id, adminBytes(file));
  if (command === 'release-undispatched' && args.length === 2)
    return releaseUndispatchedPdfCall(prisma, id);
  if (command === 'reactivate-reconciled' && args.length === 2)
    return reactivateReconciledPdfRoute(prisma, id);
  if (command === 'revoke-route' && args.length === 2) {
    await prisma.pdfProviderRoute.update({
      where: { id },
      data: { state: 'REVOKED' },
    });
    return { routeId: id, state: 'REVOKED' };
  }
  throw new PdfProviderError('PDF_PROVIDER_ADMIN_ARGUMENTS_INVALID');
}
