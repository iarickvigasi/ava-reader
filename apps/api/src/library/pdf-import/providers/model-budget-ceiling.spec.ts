import type { PrismaService } from '../../../prisma/prisma.service';
import { modelBudgetCeiling } from './model-budget-ceiling';
import { registerPdfBudget } from './register-budget';
import { requireImportBudgets } from './import-policy';
import { config } from './test-fixtures';
const flash = 'google/gemini-3.8-flash';
const route = {
  ...config,
  version: 1 as const,
  dataCollection: 'deny' as const,
  importPolicy: {
    version: 1 as const,
    workerFingerprint: 'a'.repeat(64),
    profileId: 'profile',
    configSha256: 'b'.repeat(64),
    maxRequestsPerOperation: 1,
  },
};
it.each([
  [flash, 15000000000n],
  ['other-model', 10000000000n],
  [flash + ':free', 10000000000n],
  [flash.toUpperCase(), 10000000000n],
])('pins the cumulative ceiling for exact model %s', (key, expected) => {
  expect(modelBudgetCeiling(key)).toBe(expected);
});
it.each([
  [flash, '15000000001'],
  ['other-model', '11000000000'],
  ['other-model', '15000000000'],
  [flash + ':free', '15000000000'],
])(
  'rejects unauthorized ceiling %s / %s in registration and admission',
  (scopeKey, ceiling) => {
    const transaction = jest.fn(),
      prisma = { $transaction: transaction } as unknown as PrismaService;
    expect(() =>
      registerPdfBudget(prisma, {
        scope: 'MODEL',
        scopeKey,
        limitNano: ceiling,
        hardCeilingNano: ceiling,
        baselineNano: '0',
        baselineEvidenceSha256: 'e'.repeat(64),
      }),
    ).toThrow('PDF_PROVIDER_BUDGET_INVALID');
    expect(transaction).not.toHaveBeenCalled();
    expect(() =>
      requireImportBudgets(route, [
        {
          scope: 'MODEL',
          scopeKey,
          limitNano: BigInt(ceiling),
          hardCeilingNano: BigInt(ceiling),
        },
      ]),
    ).toThrow('PDF_PROVIDER_IMPORT_BUDGET_INVALID');
  },
);
it.each([
  [flash, 14601866100n, 15000000000n],
  ['other-model', 10000000000n, 10000000000n],
])(
  'admits an authorized unchanged ceiling %s / %s / %s',
  (scopeKey, limitNano, hardCeilingNano) => {
    expect(() =>
      requireImportBudgets(route, [
        { scope: 'MODEL', scopeKey, limitNano, hardCeilingNano },
      ]),
    ).not.toThrow();
  },
);
