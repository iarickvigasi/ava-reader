import { smallCapsAttemptFixture } from './small-caps-attempt-fixture';
import { capsTask, capsParent } from './small-caps-fixture';

it('uses the existing single durable repair opportunity under the current capture', async () => {
  const run = smallCapsAttemptFixture();
  await run.page();
  await run.send('recognition', { task_id: capsParent.task_id });
  await run.send('anchor_quote', capsTask);
  expect(run.preflight).toHaveBeenCalledTimes(1);
  expect(run.dispatch).toHaveBeenCalledTimes(2);
  expect(run.dispatch.mock.calls[1][0].promptVersion).toBe(
    'ava-recognition-anchor-quote-3',
  );
  await expect(run.send('anchor_quote', capsTask)).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(2);
});
it('rejects Task3 under historical capture before preflight or correction spending', async () => {
  const run = smallCapsAttemptFixture(false);
  await run.page();
  await run.send('recognition', { task_id: capsParent.task_id });
  await expect(run.send('anchor_quote', capsTask)).rejects.toThrow();
  expect(run.preflight).not.toHaveBeenCalled();
  expect(run.dispatch).toHaveBeenCalledTimes(1);
});
it('preflight refusal prevents the correction request', async () => {
  const run = smallCapsAttemptFixture(true, true);
  await run.page();
  await run.send('recognition', { task_id: capsParent.task_id });
  await expect(run.send('anchor_quote', capsTask)).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(1);
});
