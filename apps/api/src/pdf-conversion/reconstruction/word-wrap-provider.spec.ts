import { wordWrapProviderTask } from './word-wrap-provider-task';
import { wrapResponses, wrapTask } from './word-wrap-fixture';
import { wordWrapResponse } from './word-wrap-response';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { recognitionSchemas } from './generated/schemas';

it('sends only bounded opaque lexical contexts with the exact request output cap', () => {
  const task = wordWrapProviderTask(
    wrapTask,
    wrapTask.source_sha256,
    wrapTask.profile_id,
  );
  expect(task).toMatchObject({
    purpose: 'resolve_structure',
    pageIndices: [0],
    maxOutputTokens: 16384,
    schemaVersion: 'ava-native-word-wrap-response-1',
  });
  const body = task.messages[1].content;
  if (typeof body !== 'string') throw new Error('Unexpected image content');
  const view = JSON.parse(body) as { entries: Record<string, unknown>[] };
  expect(Buffer.byteLength(body)).toBeLessThanOrEqual(48 * 1024);
  expect(view.entries).toHaveLength(128);
  expect(Object.keys(view.entries[0]).sort()).toEqual([
    'context',
    'id',
    'language',
    'role',
  ]);
  expect(body).not.toContain('candidate');
  expect(body).not.toContain('owner_id');
  expect(body).not.toContain('source_pair');
  expect(providerResponseSchema('google/gemini-2.5-flash', task)).toBeTruthy();
  expect(() =>
    providerResponseSchema('google/gemini-2.5-flash', {
      ...task,
      responseSchema: recognitionSchemas.RecognitionResponse,
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it('refuses foreign source and oversized Unicode public context before dispatch', () => {
  expect(() =>
    wordWrapProviderTask(wrapTask, 'f'.repeat(64), wrapTask.profile_id),
  ).toThrow('SOURCE_MISMATCH');
  const changed = structuredClone(wrapTask);
  changed.entries.forEach((entry) => (entry.context = '😀'.repeat(256)));
  expect(() =>
    wordWrapProviderTask(changed, wrapTask.source_sha256, wrapTask.profile_id),
  ).toThrow('RESOURCE_LIMIT');
});

it('allows a complete maximum-size decision response with formatting and reasoning headroom', () => {
  const response = {
    ...wrapResponses[0],
    decisions: wrapTask.entries.map(({ id }) => ({
      id,
      disposition: 'unresolved' as const,
    })),
  };
  const output = JSON.stringify(response, null, 2);
  expect(wordWrapResponse(wrapTask, output).decisions).toHaveLength(128);
  const task = wordWrapProviderTask(
    wrapTask,
    wrapTask.source_sha256,
    wrapTask.profile_id,
  );
  // Byte size is a conservative output-shape allowance, not a tokenizer estimate.
  // Keep extra room because the route also counts reasoning against this ceiling.
  expect(task.maxOutputTokens).toBeGreaterThanOrEqual(
    Buffer.byteLength(output) + 1024,
  );
});
