import { overflowAttemptFixture } from './overflow-attempt-fixture';
import { overflowParent, overflowTask } from './overflow-context-fixture';

it('round-trips one raw candidate and one preflighted correction, then rejects a second opportunity', async () => {
  const run = overflowAttemptFixture();
  await run.page();
  await run.send('recognition', { task_id: overflowParent.task_id });
  await run.send('anchor_context', overflowTask);
  expect(run.preflight).toHaveBeenCalledTimes(1);
  expect(run.dispatch).toHaveBeenCalledTimes(2);
  expect(run.dispatch.mock.calls[1][0].promptVersion).toBe(
    'ava-recognition-anchor-context-2',
  );
  await expect(run.send('anchor_context', overflowTask)).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  'never dispatches a correction after legacy refusal or preflight denial (%s)',
  async (current) => {
    const run = overflowAttemptFixture(current, true);
    await run.page();
    if (current) {
      await run.send('recognition', { task_id: overflowParent.task_id });
      await expect(run.send('anchor_context', overflowTask)).rejects.toThrow();
    } else
      await expect(
        run.send('recognition', { task_id: overflowParent.task_id }),
      ).rejects.toThrow();
    expect(run.dispatch).toHaveBeenCalledTimes(1);
  },
);
