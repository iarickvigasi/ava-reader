import type { Tx } from '../jobs/types';
import { allocateProviderBudgets } from './allocate';
function database(globalActualNano = 0n, globalReservedNano = 0n) {
  const budgets = ['GLOBAL', 'ACCOUNT', 'MODEL', 'OPERATION'].map((scope) => ({
    id: scope,
    scope,
    limitNano: scope === 'MODEL' ? 15000000000n : 1000000000n,
    hardCeilingNano: scope === 'MODEL' ? 15000000000n : 1000000000n,
    actualNano: scope === 'GLOBAL' ? globalActualNano : 0n,
    reservedNano: scope === 'GLOBAL' ? globalReservedNano : 0n,
  }));
  const tx = {
    pdfProviderBudget: {
      findMany: jest.fn().mockResolvedValue(budgets),
      update: jest.fn().mockResolvedValue({}),
    },
    pdfProviderAllocation: { create: jest.fn().mockResolvedValue({}) },
  };
  return { tx, budgets, ids: budgets.map((b) => b.id) };
}
it('allocates across all four scopes with an explicitly higher model ceiling', async () => {
  const { tx, ids } = database();
  await allocateProviderBudgets(tx as unknown as Tx, ids, 'call', 100000000n);
  expect(tx.pdfProviderBudget.update).toHaveBeenCalledTimes(4);
  expect(tx.pdfProviderAllocation.create).toHaveBeenCalledTimes(4);
});
it('still refuses lower global headroom including actual charges and outstanding holds', async () => {
  const { tx, ids } = database(600000000n, 350000000n);
  await expect(
    allocateProviderBudgets(tx as unknown as Tx, ids, 'call', 100000000n),
  ).rejects.toThrow('PDF_PROVIDER_BUDGET_EXHAUSTED');
  expect(tx.pdfProviderBudget.update).not.toHaveBeenCalled();
  expect(tx.pdfProviderAllocation.create).not.toHaveBeenCalled();
});
