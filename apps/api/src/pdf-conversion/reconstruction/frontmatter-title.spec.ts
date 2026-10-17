import { titleTask, titleResponse } from './frontmatter-title-fixture';
import { frontmatterTitleProviderTask } from './frontmatter-title-provider-task';
import { refinementResponse } from './refinement-response';
import { validatePacket } from './validate-packet';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { recognitionSchemas } from './generated/schemas';

const parse = (response: unknown) =>
  refinementResponse(titleTask, JSON.stringify(response));

it('requests complete unchanged candidates with the canonical response and actual output ceiling', () => {
  const request = frontmatterTitleProviderTask(
    titleTask,
    titleTask.source_sha256,
  );
  expect(request).toMatchObject({
    purpose: 'resolve_structure',
    maxOutputTokens: 3072,
    promptVersion: 'ava-printed-title-2',
    schemaVersion: 'ava-printed-title-response-2',
    pageIndices: [0, 1, 2, 3],
  });
  expect(request.responseSchema).toEqual(
    recognitionSchemas.FrontmatterTitleResponse,
  );
  const grammar = providerResponseSchema(
    'google/gemini-3.1-flash-lite-preview',
    request,
  );
  expect(grammar.properties).toHaveProperty('selected_node_id');
  expect(grammar.properties).not.toHaveProperty('text');
  expect(parse(titleResponse)).toEqual(titleResponse);
});
it.each([
  'task_id',
  'source_sha256',
  'observation_sha256',
  'image_sha256',
  'selected_text_sha256',
])('refuses a mismatched %s receipt', (field) => {
  expect(() => parse({ ...titleResponse, [field]: 'f'.repeat(64) })).toThrow(
    'SOURCE_MISMATCH',
  );
});
it.each(['text', 'style', 'chapter_start', 'replacement_text'])(
  'refuses undeclared replacement authority %s',
  (field) => {
    expect(() => parse({ ...titleResponse, [field]: 'invented' })).toThrow(
      'INVALID_RESULT',
    );
  },
);
it('permits a decline and refuses explicit ineligibility or foreign source crops', () => {
  expect(
    parse({
      ...titleResponse,
      selected_node_id: null,
      selected_text_sha256: null,
      evidence_ids: [],
      cover: null,
    }),
  ).toMatchObject({ selected_node_id: null });
  const ineligible = structuredClone(titleTask);
  ineligible.nodes.find(
    (node) => node.id === titleResponse.selected_node_id,
  )!.primary_eligible = false;
  expect(() =>
    refinementResponse(ineligible, JSON.stringify(titleResponse)),
  ).toThrow('SOURCE_MISMATCH');
  expect(() =>
    parse({
      ...titleResponse,
      evidence_ids: [titleResponse.evidence_ids[0], 'context-page2'],
    }),
  ).toThrow('SOURCE_MISMATCH');
  expect(() => parse({ ...titleResponse, selected_node_id: null })).toThrow(
    'SOURCE_MISMATCH',
  );
});
it('binds cover corroboration to unique first-page nodes in source order', () => {
  const cover = titleResponse.cover!;
  expect(() =>
    parse({
      ...titleResponse,
      cover: { ...cover, node_ids: [...cover.node_ids].reverse() },
    }),
  ).toThrow('SOURCE_MISMATCH');
  expect(() =>
    parse({
      ...titleResponse,
      cover: { ...cover, node_ids: [titleResponse.selected_node_id] },
    }),
  ).toThrow('SOURCE_MISMATCH');
  expect(() =>
    parse({
      ...titleResponse,
      cover: {
        ...cover,
        evidence_ids: [...cover.evidence_ids, cover.evidence_ids[0]],
      },
    }),
  ).toThrow();
});
it.each(['source', 'text', 'image', 'render', 'crop', 'node_box'])(
  'refuses mismatched task %s before making a request',
  (field) => {
    const task = structuredClone(titleTask);
    if (field === 'source') task.source_sha256 = 'f'.repeat(64);
    if (field === 'text') task.nodes[0].text += ' changed';
    if (field === 'image') task.image.sha256 = 'f'.repeat(64);
    if (field === 'render') task.nodes[0].render_sha256 = 'f'.repeat(64);
    if (field === 'crop') task.crops[0].image_box[2] = task.image.width + 1;
    if (field === 'node_box') task.nodes[0].box.y1 = task.nodes[0].box.y0;
    expect(() =>
      frontmatterTitleProviderTask(task, titleTask.source_sha256),
    ).toThrow('SOURCE_MISMATCH');
  },
);
it.each([
  { width: 4097 },
  { height: 4097 },
  { byte_length: 4 * 1024 ** 2 + 1 },
])('retains finite complete-sheet resource bounds %j', (image) => {
  expect(() =>
    frontmatterTitleProviderTask(
      { ...titleTask, image: { ...titleTask.image, ...image } },
      titleTask.source_sha256,
    ),
  ).toThrow('RESOURCE_LIMIT');
});
it('keeps historical batch schemas closed and caps new title cardinality', () => {
  for (const schema_version of [
    'ava-book-refinement-batch-1',
    'ava-book-refinement-batch-2',
  ])
    expect(() =>
      validatePacket(
        schema_version.endsWith('1')
          ? 'RefinementBatch'
          : 'PrintedTitleRefinementBatch',
        {
          schema_version,
          source_sha256: titleTask.source_sha256,
          tasks: [titleTask],
        },
      ),
    ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('FrontmatterTitleRefinementBatch', {
      schema_version: 'ava-book-refinement-batch-3',
      source_sha256: titleTask.source_sha256,
      source_title_policy: 'ava-frontmatter-title-1',
      tasks: [titleTask, titleTask],
    }),
  ).toThrow('INVALID_RESULT');
});
