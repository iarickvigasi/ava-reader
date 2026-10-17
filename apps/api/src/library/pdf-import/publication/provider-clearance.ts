import type { Tx } from '../jobs/types';
import { costLock } from '../providers/cost-lock';
import { PdfPublicationError } from './errors';
export async function assertPublicationProviderClearance(
  tx: Tx,
  operationId: string,
) {
  await costLock(tx);
  const grant = await tx.pdfProviderGrant.findUnique({
    where: { operationId },
    include: { route: true },
  });
  if (!grant) return;
  if (
    grant.state !== 'ACTIVE' ||
    grant.route.state !== 'ACTIVE' ||
    (await tx.pdfProviderCall.count({
      where: {
        grantId: grant.id,
        state: { in: ['RESERVED', 'DISPATCHING', 'UNCERTAIN'] },
      },
    }))
  )
    throw new PdfPublicationError('PDF_PUBLICATION_PROVIDER_UNRESOLVED');
  const budgets = await tx.pdfProviderBudget.findMany({
    where: { id: { in: grant.budgetIds } },
  });
  if (
    budgets.length !== 4 ||
    budgets.some((b) => b.actualNano + b.reservedNano > b.limitNano)
  )
    throw new PdfPublicationError('PDF_PUBLICATION_PROVIDER_UNRESOLVED');
}
