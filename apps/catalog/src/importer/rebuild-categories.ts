import type { CatalogDatabase } from '../database/catalog-database';
import { CATEGORY_VERSION, readerCategories } from './reader-categories';

export async function rebuildCategories(db: CatalogDatabase, apply: boolean) {
  const report = {
    scanned: 0,
    changed: 0,
    recategorized: 0,
    applied: 0,
    conflicts: 0,
    counts: {} as Record<string, number>,
    examples: [] as { title: string; before: string[]; after: string[] }[],
  };
  let cursor: string | undefined;
  while (true) {
    const works = await db.work.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        id: true,
        originalTitle: true,
        subjects: true,
        categories: true,
        categoryVersion: true,
        revision: true,
      },
    });
    if (!works.length) break;
    for (const work of works) {
      report.scanned++;
      const categories = readerCategories(work.subjects);
      for (const category of categories)
        report.counts[category] = (report.counts[category] ?? 0) + 1;
      if (
        work.categoryVersion === CATEGORY_VERSION &&
        JSON.stringify(work.categories) === JSON.stringify(categories)
      )
        continue;
      report.changed++;
      const different =
        JSON.stringify(work.categories) !== JSON.stringify(categories);
      if (different) report.recategorized++;
      if (different && report.examples.length < 20)
        report.examples.push({
          title: work.originalTitle.slice(0, 200),
          before: work.categories,
          after: categories,
        });
      if (!apply) continue;
      const applied = await db.$transaction(async (tx) => {
        const updated = await tx.work.updateMany({
          where: { id: work.id, revision: work.revision },
          data: {
            categories,
            categoryVersion: CATEGORY_VERSION,
            revision: { increment: 1 },
          },
        });
        if (!updated.count) return false;
        await tx.sourceMapping.updateMany({
          where: { workId: work.id, managedRevision: work.revision },
          data: { managedRevision: work.revision + 1 },
        });
        await tx.catalogOutbox.create({
          data: {
            kind: 'WORK',
            entityId: work.id,
            revision: work.revision + 1,
            eventType: 'CATEGORIES_REBUILT',
          },
        });
        return true;
      });
      if (applied) report.applied++;
      else report.conflicts++;
    }
    cursor = works.at(-1)!.id;
  }
  return report;
}
