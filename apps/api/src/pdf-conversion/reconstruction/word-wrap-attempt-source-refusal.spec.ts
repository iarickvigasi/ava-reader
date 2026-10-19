import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapBatch, wrapResponses } from './word-wrap-fixture';
import { nativeTask } from './native-structure-fixture';
import { task } from './test-fixture';

it('retains a worker lexical refusal and fences the next word-wrap call', async () => {
  const q = wrapAttempt();
  await q.prepare();
  await q.send('word_wrap_batch', wrapBatch);
  const response = structuredClone(wrapResponses[0]);
  response.decisions[0].disposition = 'unresolved';
  q.dispatch.mockResolvedValue({ output: JSON.stringify(response) });
  await q.send('word_wrap', { task_id: wrapBatch.tasks[0].task_id });
  const entry = wrapBatch.entries[0];
  await q.send('refusal', {
    schema_version: 'ava-source-refusal-1',
    source_sha256: q.context.sourceSha256,
    stage: 'assembly',
    findings: [
      {
        code: 'ESSENTIAL_STRUCTURE_UNSUPPORTED',
        severity: 'blocking',
        page: entry.left.page,
        box: entry.left.box,
        region_box: entry.left.box,
        block_id: entry.owner_id,
        segment_id_sha256: null,
        task_id: wrapBatch.tasks[0].task_id,
        render_sha256: null,
      },
    ],
  });
  expect(() => q.state.finish(1)).toThrow('UNSUPPORTED_PDF');
  await expect(
    q.send('word_wrap', { task_id: wrapBatch.tasks[1].task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('rejects an extra Prepare4 page before completing or dispatching it', async () => {
  const q = wrapAttempt();
  await q.send('page', { ...q.page, tasks: [nativeTask] });
  await q.send('native_structure', { task_id: nativeTask.task_id });
  await expect(
    q.send('page', {
      ...q.page,
      page_number: 2,
      tasks: [{ ...task, page_number: 2, task_id: 'extra-task' }],
    }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    q.send('recognition', { task_id: 'extra-task' }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.progress).not.toHaveBeenCalled();
});
