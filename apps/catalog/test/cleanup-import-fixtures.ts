import type { ImportFixture } from './importer-fixtures';

export async function cleanupImportFixtures(ctx: ImportFixture) {
  const mappings = await ctx.db.sourceMapping.findMany({
    where: {
      externalId: { in: [ctx.author, ctx.work, ctx.edition] },
      source: { key: 'open-library' },
    },
  });
  const ids = mappings.flatMap((row) =>
    [row.authorId, row.workId, row.editionId].filter(
      (id): id is string => !!id,
    ),
  );
  await ctx.db.importRun.deleteMany({
    where: { filename: { startsWith: ctx.prefix } },
  });
  await ctx.db.catalogOutbox.deleteMany({ where: { entityId: { in: ids } } });
  await ctx.db.sourceMapping.deleteMany({
    where: { id: { in: mappings.map((row) => row.id) } },
  });
  await ctx.db.edition.deleteMany({ where: { id: { in: ids } } });
  await ctx.db.work.deleteMany({ where: { id: { in: ids } } });
  await ctx.db.author.deleteMany({ where: { id: { in: ids } } });
}
