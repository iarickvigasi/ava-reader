import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapBatch } from './word-wrap-fixture';
import { checksumBuffer } from '../../shared/blob-utils';

it('refuses a declared catalogue witness outside actual source pages before prevalidation or paid dispatch', async () => {
  const q = wrapAttempt();
  await q.prepare();
  const batch = structuredClone(wrapBatch);
  batch.entries[0].left.page = 2;
  batch.entries[0].candidate.left.page = 2;
  batch.tasks[0].entries[0] = structuredClone(batch.entries[0]);
  batch.census[0].page = 2;
  const census = batch.census.map((entry) =>
    Object.fromEntries(
      Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
  batch.census_sha256 = checksumBuffer(Buffer.from(JSON.stringify(census)));
  await expect(q.send('word_wrap_batch', batch)).rejects.toThrow(
    'SOURCE_MISMATCH',
  );
  expect(q.context.validateWordWrap).not.toHaveBeenCalled();
  expect(q.dispatch).not.toHaveBeenCalled();
});
