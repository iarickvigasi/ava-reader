import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapBatch, wrapResponses } from './word-wrap-fixture';

it.each([
  'source',
  'census',
  'incomplete',
  'native-mode',
  'early',
  'old-marker',
])('refuses sparse phase %s before paid dispatch', async (change) => {
  const q = wrapAttempt(change === 'native-mode' ? 'native' : 'live');
  if (change === 'early') {
    await q.send('page', q.page);
    await expect(q.send('word_wrap_batch', wrapBatch)).rejects.toThrow();
  } else {
    await q.prepare();
    const batch = structuredClone(wrapBatch);
    if (change === 'source') batch.source_sha256 = 'f'.repeat(64);
    if (change === 'census') batch.census_sha256 = 'f'.repeat(64);
    if (change === 'incomplete') batch.tasks.pop();
    await expect(
      q.send(
        'word_wrap_batch',
        batch,
        change === 'old-marker' ? 'ava-reconstruction-exchange-1' : undefined,
      ),
    ).rejects.toThrow();
  }
  expect(q.dispatch).not.toHaveBeenCalled();
});
it('refuses a changed receipt before dispatching the next chunk', async () => {
  const q = wrapAttempt();
  await q.prepare();
  await q.send('word_wrap_batch', wrapBatch);
  q.dispatch.mockResolvedValue({
    output: JSON.stringify({
      ...wrapResponses[0],
      catalogue_sha256: 'f'.repeat(64),
    }),
  });
  await expect(
    q.send('word_wrap', { task_id: wrapBatch.tasks[0].task_id }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    q.send('word_wrap', { task_id: wrapBatch.tasks[1].task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('fences a late word-wrap response after cancellation', async () => {
  const q = wrapAttempt();
  await q.prepare();
  await q.send('word_wrap_batch', wrapBatch);
  let resolve!: (value: { output: string }) => void;
  q.dispatch.mockImplementation(
    () =>
      new Promise((ready) => {
        resolve = ready;
      }),
  );
  const pending = q.send('word_wrap', { task_id: wrapBatch.tasks[0].task_id });
  await Promise.resolve();
  q.controller.abort();
  resolve({ output: JSON.stringify(wrapResponses[0]) });
  await expect(pending).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
