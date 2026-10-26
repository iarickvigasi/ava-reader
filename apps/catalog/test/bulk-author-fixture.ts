import { stageFile } from '../src/importer/stage-file';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function bulkAuthorFixture(ctx: ImportFixture, invalid = false) {
  const keys = [1, 2, 3].map((n) =>
    ctx.author.replace(/A$/, `${Date.now()}${n}A`),
  );
  const run = await stageFile(
    ctx.db,
    await ctx.file(
      'bulk-authors',
      keys.map((key, index) =>
        dumpLine(key, 'author', {
          name: "Bulk O'Brien",
          alternate_names:
            invalid && index === 1 ? 'invalid' : ['Alias', 'Alias'],
          bio: { value: 'Biography' },
        }),
      ),
    ),
  );
  const records = await ctx.db.importRecord.findMany({
    where: { runId: run.id },
    orderBy: { line: 'asc' },
  });
  return {
    keys,
    records,
    sourceId: run.sourceId,
    async cleanup() {
      const mappings = await ctx.db.sourceMapping.findMany({
        where: { sourceId: run.sourceId, externalId: { in: keys } },
      });
      const ids = mappings.map((row) => row.authorId!);
      await ctx.db.catalogOutbox.deleteMany({
        where: { entityId: { in: ids } },
      });
      await ctx.db.sourceMapping.deleteMany({
        where: { id: { in: mappings.map((row) => row.id) } },
      });
      await ctx.db.author.deleteMany({ where: { id: { in: ids } } });
    },
  };
}
