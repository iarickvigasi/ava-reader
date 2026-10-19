import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapBatch } from './word-wrap-fixture';

it.each(['missing', 'refused', 'cancelled'])(
  'fences word paid dispatch when source prevalidation is %s',
  async (change) => {
    const validation =
      change === 'missing'
        ? null
        : change === 'refused'
          ? jest.fn(() => Promise.reject(new Error('SOURCE_MISMATCH')))
          : jest.fn(() => {
              q.controller.abort();
              return Promise.resolve();
            });
    const q: ReturnType<typeof wrapAttempt> = wrapAttempt('live', validation);
    await q.prepare();
    await q.send('word_wrap_batch', wrapBatch);
    await expect(
      q.send('word_wrap', { task_id: wrapBatch.tasks[0].task_id }),
    ).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  },
);
