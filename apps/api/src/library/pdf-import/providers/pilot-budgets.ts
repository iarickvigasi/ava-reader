import type { RouteConfiguration } from './types';
import { nanoValue } from './money';
import { PdfProviderError } from './errors';
export function requirePilotBudgets(
  config: RouteConfiguration,
  budgets: {
    scope: string;
    limitNano: bigint;
    hardCeilingNano: bigint;
  }[],
) {
  if (!config.pilotInventory) return;
  for (const budget of budgets) {
    const cap =
      budget.scope === 'MODEL'
        ? 10_000_000_000n
        : nanoValue(config.pilotInventory.totalLimitNano);
    if (
      budget.hardCeilingNano > cap ||
      budget.limitNano > budget.hardCeilingNano
    )
      throw new PdfProviderError('PDF_PROVIDER_PILOT_BUDGET_INVALID');
  }
}
