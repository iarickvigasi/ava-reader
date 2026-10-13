import {
  exchangeProtocol,
  MAX_EXCHANGE_REPLY_TOTAL,
} from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';

it('fits500pages25000originaltasks32refinements32wraptasks without raising byte budgets', () => {
  const protocol = exchangeProtocol(envelope(), true);
  let sequence = 0;
  const emit = (kind: string, payload: unknown) =>
    protocol.accept(
      encode({
        ...envelope(),
        schema_version: 'ava-reconstruction-exchange-2',
        sequence: ++sequence,
        kind,
        payload,
      }),
    );
  for (let page = 0; page < 500; page++) {
    const tasks = Array.from({ length: 50 }, (_, i) => ({
      task_id: `p${page}t${i}`,
      schema_version: 'ava-recognition-task-1',
    }));
    emit('page', { schema_version: 'ava-prepare-result-4', tasks });
    for (const task of tasks) emit('recognition', { task_id: task.task_id });
  }
  const tasks = Array.from({ length: 32 }, (_, i) => ({ task_id: `r${i}` }));
  emit('refinement_batch', { tasks });
  for (const task of tasks) emit('refinement', task);
  const wraps = tasks.map((t) => ({
    schema_version: 'ava-native-word-wrap-task-1',
    task_id: 'w' + t.task_id,
  }));
  emit('word_wrap_batch', {
    schema_version: 'ava-native-word-wrap-batch-1',
    tasks: wraps,
  });
  for (const task of wraps) emit('word_wrap', { task_id: task.task_id });
  emit('artifacts', null);
  expect(sequence).toBe(25567);
  expect(MAX_EXCHANGE_REPLY_TOTAL).toBe(64 * 1024 ** 2 + 25533 * 1024);
});
