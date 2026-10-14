import type { PrismaService } from '../../../prisma/prisma.service';
import { registerPdfBudget } from './register-budget';
const spec = {
  scope: 'MODEL' as const,
  scopeKey: 'google/gemini-flash',
  limitNano: '15000000000',
  hardCeilingNano: '15000000000',
  baselineNano: '9000000000',
  baselineEvidenceSha256: 'e'.repeat(64),
};
const existing = {
  id: 'budget',
  limitNano: 15000000000n,
  hardCeilingNano: 15000000000n,
  baselineNano: 9000000000n,
  baselineEvidenceSha256: spec.baselineEvidenceSha256,
  actualNano: 9500000000n,
  reservedNano: 400000000n,
};
function database(previous: typeof existing | null = null) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    pdfProviderBudget: {
      findUnique: jest.fn().mockResolvedValue(previous),
      create: jest.fn().mockResolvedValue({ id: 'budget' }),
    },
  };
  const transaction = jest.fn((work: (arg: typeof tx) => unknown) =>
    Promise.resolve(work(tx)),
  );
  return {
    tx,
    transaction,
    prisma: { $transaction: transaction } as unknown as PrismaService,
  };
}
it('creates the explicit $15 model ceiling with its historical baseline under the cost lock', async () => {
  const db = database();
  await expect(registerPdfBudget(db.prisma, spec)).resolves.toEqual({
    budgetId: 'budget',
  });
  expect(db.tx.$executeRaw).toHaveBeenCalledTimes(1);
  expect(db.tx.pdfProviderBudget.create).toHaveBeenCalledWith({
    data: {
      scope: spec.scope,
      scopeKey: spec.scopeKey,
      limitNano: 15000000000n,
      hardCeilingNano: 15000000000n,
      actualNano: 9000000000n,
      baselineNano: 9000000000n,
      baselineEvidenceSha256: spec.baselineEvidenceSha256,
    },
  });
});
it('verifies an exact registration without resetting existing charges or holds', async () => {
  const previous = { ...existing },
    db = database(previous);
  await expect(registerPdfBudget(db.prisma, spec)).resolves.toEqual({
    budgetId: 'budget',
  });
  expect(db.tx.pdfProviderBudget.create).not.toHaveBeenCalled();
  expect(previous).toEqual(existing);
});
it.each([
  { limitNano: '14000000000' },
  { hardCeilingNano: '16000000000' },
  { baselineNano: '8000000000' },
  { baselineEvidenceSha256: 'f'.repeat(64) },
])('refuses changing a registered budget %j', async (override) => {
  const db = database(existing);
  await expect(
    registerPdfBudget(db.prisma, { ...spec, ...override }),
  ).rejects.toThrow('PDF_PROVIDER_BUDGET_IMMUTABLE');
  expect(db.tx.pdfProviderBudget.create).not.toHaveBeenCalled();
});
it('refuses a limit above its ceiling before opening a transaction', () => {
  const db = database();
  expect(() =>
    registerPdfBudget(db.prisma, { ...spec, limitNano: '15000000001' }),
  ).toThrow('PDF_PROVIDER_BUDGET_INVALID');
  expect(db.transaction).not.toHaveBeenCalled();
});
it.each(['01', '-1', '1.0', '1e10', '10000000000000000', '', undefined])(
  'requires a bounded integer explicit ceiling: %s',
  (hardCeilingNano) => {
    const db = database();
    expect(() =>
      registerPdfBudget(db.prisma, {
        ...spec,
        hardCeilingNano: hardCeilingNano as string,
      }),
    ).toThrow('PDF_PROVIDER_COST_INVALID');
    expect(db.transaction).not.toHaveBeenCalled();
  },
);
