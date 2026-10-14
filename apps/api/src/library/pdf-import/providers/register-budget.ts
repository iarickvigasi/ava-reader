import type { PrismaService } from '../../../prisma/prisma.service';
import { costTransaction } from './cost-lock';
import { nanoValue } from './money';
import { PdfProviderError } from './errors';
export function registerPdfBudget(
  prisma: PrismaService,
  input: {
    scope: 'GLOBAL' | 'ACCOUNT' | 'MODEL' | 'OPERATION';
    scopeKey: string;
    limitNano: string;
    hardCeilingNano: string;
    baselineNano: string;
    baselineEvidenceSha256: string;
  },
) {
  const spec = { ...input },
    limit = nanoValue(spec.limitNano),
    ceiling = nanoValue(spec.hardCeilingNano),
    baseline = nanoValue(spec.baselineNano);
  if (
    !['GLOBAL', 'ACCOUNT', 'MODEL', 'OPERATION'].includes(spec.scope) ||
    !spec.scopeKey ||
    spec.scopeKey.length > 200 ||
    limit > ceiling ||
    (spec.scope === 'MODEL' && ceiling > 10000000000n) ||
    !/^[a-f0-9]{64}$/.test(spec.baselineEvidenceSha256)
  )
    throw new PdfProviderError('PDF_PROVIDER_BUDGET_INVALID');
  return costTransaction(prisma, async (tx) => {
    const previous = await tx.pdfProviderBudget.findUnique({
      where: { scope_scopeKey: { scope: spec.scope, scopeKey: spec.scopeKey } },
    });
    if (previous) {
      if (
        previous.limitNano !== limit ||
        previous.hardCeilingNano !== ceiling ||
        previous.baselineNano !== baseline ||
        previous.baselineEvidenceSha256 !== spec.baselineEvidenceSha256
      )
        throw new PdfProviderError('PDF_PROVIDER_BUDGET_IMMUTABLE');
      return { budgetId: previous.id };
    }
    const created = await tx.pdfProviderBudget.create({
      data: {
        scope: spec.scope,
        scopeKey: spec.scopeKey,
        limitNano: limit,
        hardCeilingNano: ceiling,
        actualNano: baseline,
        baselineNano: baseline,
        baselineEvidenceSha256: spec.baselineEvidenceSha256,
      },
    });
    return { budgetId: created.id };
  });
}
