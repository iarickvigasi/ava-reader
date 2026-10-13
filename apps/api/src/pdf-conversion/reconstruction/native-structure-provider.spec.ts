import Ajv from 'ajv/dist/2020';
import { nativeStructureProviderTask } from './native-structure-provider-task';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { recognitionSchemas } from './generated/schemas';
import { NATIVE_STRUCTURE_PROMPT } from './generated/native-structure-prompt';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { route } from '../../library/pdf-import/providers/test-fixtures';

const provider = () =>
  nativeStructureProviderTask(nativeTask, nativeTask.source_sha256, 1);

it('requests source-ID decisions through the existing structure ledger with a limited native view', () => {
  const task = provider();
  expect(task).toMatchObject({
    taskId: nativeTask.task_id,
    purpose: 'resolve_structure',
    pageIndices: [0],
    promptVersion: 'ava-native-structure-1',
    schemaVersion: 'ava-native-structure-response-1',
  });
  expect(task.responseSchema).toBe(recognitionSchemas.NativeStructureResponse);
  expect(task.responseSchema).not.toBe(recognitionSchemas.RecognitionResponse);
  expect(task.messages[0].content).toBe(NATIVE_STRUCTURE_PROMPT);
  const content = task.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw new Error('Expected model view');
  const view = JSON.parse(content[0].text) as {
    lines: object[];
    regions: object[];
    eligible_callouts: unknown;
    render_sha256: string;
  };
  expect(Object.keys(view.lines[0]).sort()).toEqual(['box', 'id', 'text']);
  expect(Object.keys(view.regions[0]).sort()).toEqual([
    'artifact_id',
    'box',
    'id',
    'line_ids',
    'role',
  ]);
  expect(view.eligible_callouts).toEqual(nativeTask.eligible_callouts);
  expect(view.render_sha256).toBe(nativeTask.image.sha256);
  expect(content[0].text).not.toMatch(
    /text_sha256|segment_sha256|vertical_align|"spans"|"style"|"base64"/,
  );
});

it.each(['source', 'page', 'image', 'text', 'callout'] as const)(
  'refuses a changed %s binding before constructing provider work',
  (field) => {
    const task = structuredClone(nativeTask);
    if (field === 'source') task.source_sha256 = 'f'.repeat(64);
    if (field === 'page') task.page_number = 2;
    if (field === 'image')
      task.image.base64 = Buffer.from('changed pixels').toString('base64');
    if (field === 'text') task.lines[0].text = 'replacement prose';
    if (field === 'callout') task.eligible_callouts[0].exact_text = 'changed';
    expect(() =>
      nativeStructureProviderTask(task, nativeTask.source_sha256, 1),
    ).toThrow('SOURCE_MISMATCH');
  },
);

it('selects a dedicated Gemini native grammar while canonical authority rejects replacement fields', () => {
  const task = provider();
  const grammar = providerResponseSchema(
    'google/gemini-contract-control',
    task,
  );
  const check = new Ajv({ strict: false }).compile(grammar);
  expect(check(nativeResponse)).toBe(true);
  expect(check({ ...nativeResponse, text: 'replacement prose' })).toBe(false);
  expect(
    check({
      ...nativeResponse,
      references: [
        { span_id: 'caller', role: 'note_callout', note_label: 'invented' },
      ],
    }),
  ).toBe(false);
  expect(providerResponseSchema(route.modelId, task)).toBe(task.responseSchema);
  expect(() =>
    providerResponseSchema('google/gemini-contract-control', {
      ...task,
      responseSchema: recognitionSchemas.RecognitionResponse,
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  expect(() => prepareProviderRequest(route, task)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
});
