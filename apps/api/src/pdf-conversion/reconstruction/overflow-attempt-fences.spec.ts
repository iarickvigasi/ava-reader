import { overflowAttemptFixture } from './overflow-attempt-fixture';
import {
  overflowParent,
  overflowTask,
  overflowResponse,
  overflowOriginal,
} from './overflow-context-fixture';
import { anchorContextResponse } from './anchor-context-response';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';

it('continues only after the complete context correction is accepted', async () => {
  const run = overflowAttemptFixture();
  const next = { ...overflowParent, task_id: 'recognize-' + 'b'.repeat(64) };
  const corrected = anchorContextResponse(
    overflowTask,
    JSON.stringify(overflowResponse),
    overflowParent,
    overflowOriginal,
  ).corrected!;
  run.dispatch
    .mockResolvedValueOnce({ output: JSON.stringify(overflowResponse) })
    .mockResolvedValueOnce({
      output: JSON.stringify({ ...corrected, task_id: next.task_id }),
    });
  await run.page([overflowParent, next]);
  await run.send('recognition', { task_id: overflowParent.task_id });
  await run.send('anchor_context', overflowTask);
  await run.send('recognition', { task_id: next.task_id });
  expect(run.dispatch).toHaveBeenCalledTimes(3);
  expect(run.preflight).toHaveBeenCalledTimes(1);
});

it('refuses policy2 without the captured continuation policy before correction dispatch', async () => {
  const run = overflowAttemptFixture(true, false, false);
  await run.page();
  await expect(
    run.send('recognition', { task_id: overflowParent.task_id }),
  ).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(1);
  expect(run.preflight).not.toHaveBeenCalled();
});

it.each<ExchangeEnvelope['kind']>([
  'recognition',
  'native_structure',
  'page',
  'geometry',
  'anchor_quote',
  'refinement_batch',
  'refinement',
  'word_wrap_batch',
  'word_wrap',
  'artifacts',
])('a pending raw candidate cannot advance to %s', async (kind) => {
  const run = overflowAttemptFixture();
  const next = { ...overflowParent, task_id: 'recognize-' + 'b'.repeat(64) };
  await run.page([overflowParent, next]);
  await run.send('recognition', { task_id: overflowParent.task_id });
  await expect(run.send(kind, { task_id: next.task_id })).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(1);
  expect(run.preflight).not.toHaveBeenCalled();
});

it('refuses a historical context task while the overflow candidate is pending', async () => {
  const run = overflowAttemptFixture();
  await run.page();
  await run.send('recognition', { task_id: overflowParent.task_id });
  await expect(
    run.send('anchor_context', {
      ...overflowTask,
      schema_version: 'ava-recognition-anchor-context-task-1',
    }),
  ).rejects.toThrow();
  expect(run.dispatch).toHaveBeenCalledTimes(1);
  expect(run.preflight).not.toHaveBeenCalled();
});
