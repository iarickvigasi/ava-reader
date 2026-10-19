import { nativeAttempt } from './native-structure-attempt-fixture';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { task, response } from './test-fixture';
import { recognitionRefusal } from './recognition-refusal';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';

it('dispatches native decisions and unchanged OCR separately in advertised order through one ledger', async () => {
  const q = nativeAttempt();
  await q.send('page', { ...q.page, tasks: [nativeTask, task] });
  expect(q.dispatch).not.toHaveBeenCalled();
  const native = JSON.parse(
    (
      await q.send('native_structure', { task_id: nativeTask.task_id })
    ).toString(),
  ) as ExchangeEnvelope;
  expect(native.schema_version).toBe('ava-native-structure-exchange-1');
  expect(native.payload).toEqual([nativeResponse]);
  const ocr = JSON.parse(
    (await q.send('recognition', { task_id: task.task_id })).toString(),
  ) as ExchangeEnvelope;
  expect(ocr.payload).toEqual([response]);
  expect(q.dispatch.mock.calls.map(([provider]) => provider)).toMatchObject([
    {
      purpose: 'resolve_structure',
      schemaVersion: 'ava-native-structure-response-1',
    },
    {
      purpose: 'transcribe_region',
      schemaVersion: 'ava-recognition-response-2',
    },
  ]);
  expect(
    q.dispatch.mock.calls.every(([, signal]) => signal === q.controller.signal),
  ).toBe(true);
  expect(q.progress).not.toHaveBeenCalled();
  await q.send('refinement_batch', q.batch);
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 2 });
});

it('requires worker semantic acceptance before requesting another dispatch after a native receipt', async () => {
  const q = nativeAttempt();
  await q.send('page', { ...q.page, tasks: [nativeTask, task] });
  await q.send('native_structure', { task_id: nativeTask.task_id });
  await q.send(
    'refusal',
    recognitionRefusal(task, {
      ...response,
      unresolved: ['source uncertainty'],
    }).diagnostic(),
  );
  expect(() => q.state.finish(1)).toThrow('UNSUPPORTED_PDF');
  await expect(
    q.send('recognition', { task_id: task.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.progress).not.toHaveBeenCalled();
});

it('rejects changed native receipts and keeps later tasks fenced', async () => {
  const q = nativeAttempt();
  q.dispatch.mockResolvedValue({
    output: JSON.stringify({
      ...nativeResponse,
      observation_sha256: 'f'.repeat(64),
    }),
  });
  await q.send('page', { ...q.page, tasks: [nativeTask, task] });
  await expect(
    q.send('native_structure', { task_id: nativeTask.task_id }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    q.send('recognition', { task_id: task.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});

it('fences a late native provider response after session cancellation', async () => {
  const q = nativeAttempt();
  let resolve!: (value: { output: string }) => void;
  q.dispatch.mockImplementation(
    () =>
      new Promise((ready) => {
        resolve = ready;
      }),
  );
  await q.send('page', q.page);
  const pending = q.send('native_structure', { task_id: nativeTask.task_id });
  await Promise.resolve();
  q.controller.abort();
  resolve({ output: JSON.stringify(nativeResponse) });
  await expect(pending).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(q.progress).not.toHaveBeenCalled();
});
