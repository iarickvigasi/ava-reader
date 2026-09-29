import type { PrismaService } from '../../../prisma/prisma.service';
export async function pdfProviderMetrics(prisma: PrismaService) {
  const [budgets, calls, routes, unresolved] = await Promise.all([
    prisma.pdfProviderBudget.findMany({
      select: {
        scope: true,
        scopeKey: true,
        limitNano: true,
        actualNano: true,
        reservedNano: true,
        baselineNano: true,
      },
    }),
    prisma.pdfProviderCall.groupBy({ by: ['state'], _count: { _all: true } }),
    prisma.pdfProviderRoute.groupBy({ by: ['state'], _count: { _all: true } }),
    prisma.pdfProviderCall.findMany({
      where: { state: { in: ['DISPATCHING', 'UNCERTAIN'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        state: true,
        accountKey: true,
        providerGenerationId: true,
        requestSha256: true,
        createdAt: true,
        failureCode: true,
      },
    }),
  ]);
  return {
    snapshot: 'nontransactional',
    budgets: budgets.map((b) => ({
      ...b,
      limitNano: b.limitNano.toString(),
      actualNano: b.actualNano.toString(),
      reservedNano: b.reservedNano.toString(),
      baselineNano: b.baselineNano.toString(),
    })),
    calls,
    routes,
    unresolved,
  };
}
