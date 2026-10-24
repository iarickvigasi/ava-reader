import assert from 'node:assert/strict';
import { runImport } from '../src/importer/run-import';
import type { ImportFixture } from './importer-fixtures';

export async function verifyPartialImport(
  ctx: ImportFixture,
  filename: string,
) {
  const mapping = await ctx.mapped(ctx.work);
  const edition = await ctx.mapped(ctx.edition);
  const partial = await ctx.db.work.findUniqueOrThrow({
    where: { id: mapping.workId! },
    include: { credits: true },
  });
  assert.equal(partial.metadataIncomplete, true);
  assert.equal(partial.originalTitle, 'Fixture edition');
  assert.equal(partial.credits.length, 0);
  const where = { entityId: { in: [mapping.workId!, edition.editionId!] } };
  const count = await ctx.db.catalogOutbox.count({ where });
  await runImport(ctx.db, filename);
  assert.equal(await ctx.db.catalogOutbox.count({ where }), count);
  return mapping.workId;
}
