import { nativeAttempt } from './native-structure-attempt-fixture';
import { nativeTask } from './native-structure-fixture';
import { task, prepared } from './test-fixture';

it.each([false, true])(
  'refuses a page beyond declared source coverage before completing or dispatching it (native=%s)',
  async (native) => {
    const q = nativeAttempt('live', native);
    const first = native ? nativeTask : task;
    const page = native ? q.page : prepared;
    const kind = native ? 'native_structure' : 'recognition';
    await q.send('page', page);
    await q.send(kind, { task_id: first.task_id });
    expect(q.dispatch).toHaveBeenCalledTimes(1);
    await expect(
      q.send('page', {
        ...page,
        page_number: 2,
        tasks: [{ ...first, task_id: 'second-source-task', page_number: 2 }],
      }),
    ).rejects.toThrow('SOURCE_MISMATCH');
    await expect(
      q.send(kind, { task_id: 'second-source-task' }),
    ).rejects.toThrow('INVALID_RESULT');
    expect(q.dispatch).toHaveBeenCalledTimes(1);
    expect(q.progress).not.toHaveBeenCalled();
  },
);
