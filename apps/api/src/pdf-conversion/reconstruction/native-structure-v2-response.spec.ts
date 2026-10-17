import { nativeTask2, nativeResponse2 } from './native-structure-v2-fixture';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { nativeStructure2Response } from './native-structure-v2-response';
import { nativeStructureResponse } from './native-structure-response';
import { nativeStructure2ProviderTask } from './native-structure-v2-provider-task';
import { nativeStructurePublicView } from './native-structure-public-view';

it('preserves exact typed provider order and emits only the sparse native public view', () => {
  const response = structuredClone(nativeResponse2);
  response.groups.reverse();
  const output = JSON.stringify(response);
  expect(nativeStructure2Response(nativeTask2, output)).toEqual(response);
  expect(JSON.parse(output)).toEqual(response);
  const task = nativeStructure2ProviderTask(
    nativeTask2,
    nativeTask2.source_sha256,
    nativeTask2.page_number,
  );
  expect(task).toMatchObject({
    purpose: 'resolve_structure',
    promptVersion: 'ava-native-structure-2',
    schemaVersion: 'ava-native-structure-response-2',
  });
  expect(task.messages[1].content).toEqual([
    {
      type: 'text',
      text: JSON.stringify(nativeStructurePublicView(nativeTask2)),
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${nativeTask2.image.media_type};base64,${nativeTask2.image.base64}`,
      },
    },
  ]);
});

it('keeps Task1/Response2 and Task2/Response1 closed with no fallback/coercion', () => {
  expect(() =>
    nativeStructureResponse(nativeTask, JSON.stringify(nativeResponse2)),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    nativeStructure2Response(nativeTask2, JSON.stringify(nativeResponse)),
  ).toThrow('INVALID_RESULT');
});

it.each([
  'task_id',
  'source_sha256',
  'observation_sha256',
  'render_sha256',
] as const)('refuses mismatched Native2 %s', (key) => {
  expect(() =>
    nativeStructure2Response(
      nativeTask2,
      JSON.stringify({
        ...nativeResponse2,
        [key]: key === 'task_id' ? 'foreign-task' : 'f'.repeat(64),
      }),
    ),
  ).toThrow('SOURCE_MISMATCH');
});

it.each([
  'missing',
  'repeated',
  'reversed',
  'foreign',
  'cross-region',
  'artifact',
  'furniture',
  'boundary',
  'reference',
])('refuses unsafe Native2 %s ownership', (caseName) => {
  const task = structuredClone(nativeTask2),
    response = structuredClone(nativeResponse2);
  if (caseName === 'missing') response.groups[0].line_ids.pop();
  if (caseName === 'repeated')
    response.groups[0].line_ids.push(response.groups[0].line_ids[0]);
  if (caseName === 'reversed') response.groups[0].line_ids.reverse();
  if (caseName === 'foreign') response.groups[0].line_ids[0] = 'foreign-line';
  if (caseName === 'cross-region') response.groups[0].region_id = 'notes';
  if (caseName === 'artifact')
    task.artifacts.push({
      id: response.groups[0].id,
      kind: 'figure',
      segment_sha256: 'f'.repeat(64),
    });
  if (caseName === 'furniture') task.regions[0].source.role = 'furniture';
  if (caseName === 'boundary')
    response.boundary_dispositions[0].candidate_sha256 = 'f'.repeat(64);
  if (caseName === 'reference') response.references[0].span_id = 'foreign-span';
  expect(() =>
    nativeStructure2Response(task, JSON.stringify(response)),
  ).toThrow('SOURCE_MISMATCH');
});
