import { applyRecords } from '../src/importer/apply-records';
import { stageFile } from '../src/importer/stage-file';
import type { Kind } from '../src/importer/types';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export function bulkLinkedFixture(ctx: ImportFixture) {
  const keys: string[] = [];
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  let sequence = 0;
  return {
    key(kind: Kind) {
      const prefix =
        kind === 'AUTHOR'
          ? '/authors/'
          : kind === 'WORK'
            ? '/works/'
            : '/books/';
      const key = `${prefix}OL${suffix}${sequence++}${kind === 'AUTHOR' ? 'A' : kind === 'WORK' ? 'W' : 'M'}`;
      keys.push(key);
      return key;
    },
    async stage(label: string, rows: Parameters<typeof dumpLine>[]) {
      const run = await stageFile(
        ctx.db,
        await ctx.file(
          label,
          rows.map((row) => dumpLine(...row)),
        ),
      );
      const records = await ctx.db.importRecord.findMany({
        where: { runId: run.id },
        orderBy: { line: 'asc' },
      });
      return {
        records,
        sourceId: run.sourceId,
        apply: async () =>
          applyRecords(
            ctx.db,
            await ctx.db.importRecord.findMany({
              where: { runId: run.id },
              orderBy: { line: 'asc' },
            }),
            run.sourceId,
          ),
      };
    },
    async apply(label: string, rows: Parameters<typeof dumpLine>[]) {
      return (await this.stage(label, rows)).apply();
    },
    outcome(id: string) {
      return ctx.db.importRecord.findUniqueOrThrow({ where: { id } });
    },
    async cleanup() {
      const mappings = await ctx.db.sourceMapping.findMany({
        where: { externalId: { in: keys } },
      });
      const ids = mappings.flatMap((row) =>
        [row.authorId, row.workId, row.editionId].filter(
          (id): id is string => !!id,
        ),
      );
      await ctx.db.catalogOutbox.deleteMany({
        where: { entityId: { in: ids } },
      });
      await ctx.db.sourceMapping.deleteMany({
        where: { id: { in: mappings.map((row) => row.id) } },
      });
      await ctx.db.edition.deleteMany({ where: { id: { in: ids } } });
      await ctx.db.work.deleteMany({ where: { id: { in: ids } } });
      await ctx.db.author.deleteMany({ where: { id: { in: ids } } });
    },
  };
}
