import type { Tx } from '../jobs/types';
import { PdfProviderError } from './errors';
export async function allocateProviderBudgets(
  tx: Tx,
  budgetIds: string[],
  callId: string,
  amount: bigint,
) {
  if (budgetIds.length !== 4 || new Set(budgetIds).size !== 4)
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  const budgets = await tx.pdfProviderBudget.findMany({
    where: { id: { in: budgetIds } },
    orderBy: { id: 'asc' },
  });
  if (budgets.length !== 4 || new Set(budgets.map((b) => b.scope)).size !== 4)
    throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
  for (const budget of budgets) {
    if (
      budget.actualNano + budget.reservedNano + amount > budget.limitNano ||
      budget.limitNano > budget.hardCeilingNano
    )
      throw new PdfProviderError('PDF_PROVIDER_BUDGET_EXHAUSTED');
    await tx.pdfProviderBudget.update({
      where: { id: budget.id },
      data: { reservedNano: { increment: amount } },
    });
    await tx.pdfProviderAllocation.create({
      data: { callId, budgetId: budget.id, reservedNano: amount },
    });
  }
}
