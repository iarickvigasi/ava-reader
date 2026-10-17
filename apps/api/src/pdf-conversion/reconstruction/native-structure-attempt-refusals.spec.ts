import { nativeAttempt } from './native-structure-attempt-fixture';
import { nativeTask } from './native-structure-fixture';
import { task } from './test-fixture';

it.each([
  'marker',
  'kind',
  'observation',
  'policy',
  'old-page',
  'uncaptured',
  'native-mode',
])('refuses native %s interchange before dispatch', async (change) => {
  const q = nativeAttempt(
    change === 'native-mode' ? 'native' : 'live',
    change !== 'uncaptured',
  );
  if (change === 'observation') q.page.observation_sha256 = 'f'.repeat(64);
  if (change === 'policy') q.page.source_structure_policy = 'unknown';
  if (change === 'old-page') q.page.schema_version = 'ava-prepare-result-2';
  if (
    ['observation', 'policy', 'old-page', 'uncaptured', 'native-mode'].includes(
      change,
    )
  ) {
    await expect(q.send('page', q.page)).rejects.toThrow();
  } else {
    await q.send('page', q.page);
    await expect(
      q.send(
        change === 'kind' ? 'recognition' : 'native_structure',
        { task_id: nativeTask.task_id },
        change === 'marker' ? 'ava-reconstruction-exchange-1' : undefined,
      ),
    ).rejects.toThrow('INVALID_RESULT');
  }
  expect(q.dispatch).not.toHaveBeenCalled();
});

it('refuses native kind for an advertised OCR task and OCR authority for an advertised native task', async () => {
  for (const kind of ['recognition', 'native_structure'] as const) {
    const q = nativeAttempt();
    const advertised = kind === 'recognition' ? nativeTask : task;
    await q.send('page', { ...q.page, tasks: [advertised] });
    await expect(q.send(kind, { task_id: advertised.task_id })).rejects.toThrow(
      'INVALID_RESULT',
    );
    expect(q.dispatch).not.toHaveBeenCalled();
  }
});
