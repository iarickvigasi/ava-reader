import {
  overflowParent,
  overflowOriginal,
  overflowTask,
  overflowResponse,
} from './overflow-context-fixture';
import { overflowContextBinding } from './overflow-context-binding';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { anchorContextResponse } from './anchor-context-response';
import { OVERFLOW_CONTEXT_PROMPT } from './generated/prompt';
import { recognitionResponse } from './recognition-response';

it('binds all Python-generated immutable slots and uses the distinct prompt with one durable parent identity', () => {
  expect(
    overflowContextBinding(overflowTask, overflowParent, overflowOriginal),
  ).toEqual(overflowTask);
  const provider = anchorContextProviderTask(
    overflowTask,
    overflowParent,
    overflowOriginal,
  );
  expect(provider.promptVersion).toBe('ava-recognition-anchor-context-2');
  expect(provider.messages[0]).toEqual({
    role: 'system',
    content: OVERFLOW_CONTEXT_PROMPT,
  });
  expect(provider.taskId).toMatch(/^anchor-context-parent-/);
  expect(provider.schemaVersion).toBe(
    'ava-recognition-anchor-context-response-1',
  );
  const result = anchorContextResponse(
    overflowTask,
    JSON.stringify(overflowResponse),
    overflowParent,
    overflowOriginal,
  );
  expect(result.corrected).not.toBeNull();
  expect(
    recognitionResponse(overflowParent, JSON.stringify(result.corrected)),
  ).toEqual(result.corrected);
  expect(result.corrected?.segments.map((s) => s.text)).toEqual(
    overflowOriginal.segments.map((s) => s.text),
  );
  expect(overflowOriginal.segments[0].spans[0].anchor?.before?.length).toBe(
    161,
  );
});

it.each([
  'source_sha256',
  'original_response_sha256',
  'native_evidence_sha256',
  'task_id',
] as const)('rejects altered %s before a provider task is returned', (key) => {
  expect(() =>
    anchorContextProviderTask(
      { ...overflowTask, [key]: 'c'.repeat(64) },
      overflowParent,
      overflowOriginal,
    ),
  ).toThrow();
});

it('requires complete unique slots and forbids extra patch authority', () => {
  for (const slots of [
    overflowTask.slots.slice(0, 1),
    [overflowTask.slots[0], overflowTask.slots[0]],
  ])
    expect(() =>
      overflowContextBinding(
        { ...overflowTask, slots },
        overflowParent,
        overflowOriginal,
      ),
    ).toThrow();
  const reply = structuredClone(overflowResponse);
  Object.assign(reply.patches[0], { text: 'invented' });
  expect(() =>
    anchorContextResponse(
      overflowTask,
      JSON.stringify(reply),
      overflowParent,
      overflowOriginal,
    ),
  ).toThrow();
});
