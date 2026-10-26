import assert from 'node:assert/strict';
import type { ImportFixture } from './importer-fixtures';

export async function verifyImportAutovacuum(ctx: ImportFixture) {
  const options = await ctx.db.$queryRaw<
    { option_name: string; option_value: string }[]
  >`
    SELECT option_name, option_value FROM pg_class AS c
    CROSS JOIN LATERAL pg_options_to_table(c.reloptions)
    WHERE c.oid = 'public."ImportRecord"'::regclass`;
  const settings = new Map(
    options.map((row) => [row.option_name, Number(row.option_value)]),
  );
  assert.equal(settings.get('autovacuum_vacuum_threshold'), 25000);
  assert.equal(settings.get('autovacuum_vacuum_scale_factor'), 0.005);
  assert.equal(settings.get('autovacuum_analyze_threshold'), 25000);
  assert.equal(settings.get('autovacuum_analyze_scale_factor'), 0.01);
  assert.equal(25000 + 0.005 * 15450000, 102250);
}
