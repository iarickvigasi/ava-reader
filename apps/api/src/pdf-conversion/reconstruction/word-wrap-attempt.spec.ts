import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapBatch, wrapResponses } from './word-wrap-fixture';
import { nativeTask } from './native-structure-fixture';
import { task } from './test-fixture';
import { checksumBuffer } from '../../shared/blob-utils';

it('dispatches finite wrap chunks only after mixed original tasks and accepted refinements', async () => {
  const q = wrapAttempt();
  await q.send('page', { ...q.page, tasks: [nativeTask, task] });
  await q.send('native_structure', { task_id: nativeTask.task_id });
  await q.send('recognition', { task_id: task.task_id });
  await q.send('refinement_batch', q.batch);
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  await q.send('word_wrap_batch', wrapBatch);
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  for (const wordTask of wrapBatch.tasks) {
    const result = JSON.parse(
      (await q.send('word_wrap', { task_id: wordTask.task_id })).toString(),
    ) as { payload: unknown[] };
    expect(result.payload).toEqual([wrapResponses[wordTask.batch_index]]);
  }
  expect(q.dispatch.mock.calls.slice(2).map(([t]) => t)).toMatchObject([
    { purpose: 'resolve_structure', maxOutputTokens: 3072 },
    { purpose: 'resolve_structure', maxOutputTokens: 3072 },
  ]);
  expect(
    q.dispatch.mock.calls.every(([, signal]) => signal === q.controller.signal),
  ).toBe(true);
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 2 });
});
it('classifies wrap candidates from zero-task native pages', async () => {
  const q = wrapAttempt();
  await q.prepare();
  await q.send('word_wrap_batch', wrapBatch);
  for (const t of wrapBatch.tasks)
    await q.send('word_wrap', { task_id: t.task_id });
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 0 });
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});
it('requires acknowledgement of an empty complete catalogue without model dispatch', async () => {
  const q = wrapAttempt();
  await q.prepare();
  const empty = checksumBuffer(Buffer.from('[]'));
  await q.send('word_wrap_batch', {
    ...wrapBatch,
    entries: [],
    census: [],
    tasks: [],
    catalogue_sha256: empty,
    census_sha256: empty,
  });
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 0 });
  expect(q.dispatch).not.toHaveBeenCalled();
});
