import Ajv from 'ajv';
import {
  nativeTask2,
  nativeResponse2,
} from '../../../pdf-conversion/reconstruction/native-structure-v2-fixture';
import { nativeStructure2ProviderTask } from '../../../pdf-conversion/reconstruction/native-structure-v2-provider-task';
import { nativeStructure2Response } from '../../../pdf-conversion/reconstruction/native-structure-v2-response';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';
import { providerResponseSchema } from './response-schema';
import { nativeStructureGenerationSchema } from './native-structure-generation-schema';

const model = 'google/gemini-contract-control';
const task = nativeStructure2ProviderTask(
  nativeTask2,
  nativeTask2.source_sha256,
  nativeTask2.page_number,
);
const generic = geminiRecognitionSchema(
  task.responseSchema,
  task.schemaVersion,
);
const projected = () => {
  const result = structuredClone(task);
  const message = result.messages[1];
  if (typeof message.content === 'string' || message.content[0].type !== 'text')
    throw new Error('fixture');
  return {
    result,
    part: message.content[0],
    view: JSON.parse(message.content[0].text) as Record<string, unknown>,
  };
};
const arrays = (schema: Record<string, unknown>) => {
  const properties = schema.properties as Record<
    string,
    Record<string, unknown>
  >;
  const variants = (
    properties.groups.items as { anyOf: { properties: { line_ids: object } }[] }
  ).anyOf;
  return {
    properties,
    lineIds: variants.map((variant) => variant.properties.line_ids),
  };
};

it('uses the validated authored source counts and preserves every other grammar field and input byte', () => {
  const before = JSON.stringify(task);
  const grammar = providerResponseSchema(model, task);
  const { properties, lineIds } = arrays(grammar);
  expect(properties.groups.maxItems).toBe(3);
  expect(lineIds).toHaveLength(8);
  for (const line of lineIds)
    expect(line).toMatchObject({ minItems: 1, maxItems: 3 });
  expect(properties.boundary_dispositions).toMatchObject({
    maxItems: 1,
  });
  expect(properties.boundary_dispositions.minItems).toBeUndefined();
  expect(properties.references.maxItems).toBe(1);
  expect(properties.unresolved.maxItems).toBe(100);
  const restored = structuredClone(grammar),
    original = arrays(generic),
    changed = arrays(restored);
  changed.properties.groups.maxItems = original.properties.groups.maxItems;
  changed.lineIds.forEach((line, index) =>
    Object.assign(line, original.lineIds[index]),
  );
  changed.properties.boundary_dispositions.maxItems =
    original.properties.boundary_dispositions.maxItems;
  changed.properties.references.maxItems =
    original.properties.references.maxItems;
  expect(restored).toEqual(generic);
  expect(JSON.stringify(task)).toBe(before);
  expect(new Ajv({ strict: false }).compile(grammar)(nativeResponse2)).toBe(
    true,
  );
  expect(
    nativeStructure2Response(nativeTask2, JSON.stringify(nativeResponse2)),
  ).toEqual(nativeResponse2);
});

it('bounds an authored 40-line public projection with no boundaries/callouts, and deduplicates eligible IDs', () => {
  const { result, part, view } = projected();
  view.lines = Array.from({ length: 40 }, (_, index) => ({
    id: `authored-${index}`,
  }));
  view.boundaries = [];
  view.eligible_callouts = [];
  part.text = JSON.stringify(view);
  const { properties, lineIds } = arrays(providerResponseSchema(model, result));
  expect(properties.groups.maxItems).toBe(40);
  for (const line of lineIds) expect(line).toMatchObject({ maxItems: 40 });
  expect(properties.boundary_dispositions).toMatchObject({
    maxItems: 0,
  });
  expect(properties.references.maxItems).toBe(0);
  const nonzero = projected();
  nonzero.view.eligible_callouts = [
    ...nativeTask2.eligible_callouts,
    ...nativeTask2.eligible_callouts,
  ];
  nonzero.part.text = JSON.stringify(nonzero.view);
  expect(
    arrays(providerResponseSchema(model, nonzero.result)).properties.references
      .maxItems,
  ).toBe(1);
});

it('retains the canonical group ceiling on larger source inventories', () => {
  const { result, part, view } = projected();
  view.lines = Array.from({ length: 2500 }, (_, index) => ({
    id: `authored-${index}`,
  }));
  view.boundaries = [];
  view.eligible_callouts = [];
  part.text = JSON.stringify(view);
  const { properties, lineIds } = arrays(providerResponseSchema(model, result));
  expect(properties.groups.maxItems).toBe(2000);
  for (const line of lineIds) expect(line).toMatchObject({ maxItems: 2500 });
});

it('preserves an unresolved decline in generation while strict source acceptance still refuses', () => {
  const response = {
    ...nativeResponse2,
    groups: [],
    boundary_dispositions: [],
    references: [],
    unresolved: ['Unclear source grouping.'],
  };
  expect(validatePacket('NativeStructureResponse2', response)).toEqual(
    response,
  );
  expect(
    new Ajv({ strict: false }).compile(providerResponseSchema(model, task))(
      response,
    ),
  ).toBe(true);
  expect(() =>
    nativeStructure2Response(nativeTask2, JSON.stringify(response)),
  ).toThrow('SOURCE_MISMATCH');
});

it.each([
  'groups',
  'line_ids',
  'boundary_dispositions',
  'references',
  'role',
  'digest',
])(
  'keeps bounded generation and strict source refusal for invalid %s responses',
  (change) => {
    const response = structuredClone(nativeResponse2);
    if (change === 'groups')
      response.groups = Array.from({ length: 4 }, () => response.groups[0]);
    if (change === 'line_ids')
      response.groups[0].line_ids = [
        response.groups[0].line_ids[0],
        response.groups[0].line_ids[0],
        response.groups[0].line_ids[0],
        response.groups[0].line_ids[0],
      ];
    if (change === 'boundary_dispositions') response.boundary_dispositions = [];
    if (change === 'references')
      response.references.push(response.references[0]);
    if (change === 'role')
      Object.assign(response.groups[0], { chapter_role: 'bodymatter' });
    if (change === 'digest')
      response.boundary_dispositions[0].candidate_sha256 = 'f'.repeat(64);
    const accepts = new Ajv({ strict: false }).compile(
      providerResponseSchema(model, task),
    );
    expect(accepts(response)).toBe(
      ['digest', 'boundary_dispositions'].includes(change),
    );
    expect(() =>
      nativeStructure2Response(nativeTask2, JSON.stringify(response)),
    ).toThrow();
  },
);

it.each(['purpose', 'promptVersion', 'schemaVersion'] as const)(
  'refuses mismatched Native2 %s task authority',
  (key) => {
    const changed = {
      ...task,
      [key]: key === 'purpose' ? ('transcribe_region' as const) : 'foreign',
    };
    expect(() => nativeStructureGenerationSchema(generic, changed)).toThrow(
      'PDF_PROVIDER_REQUEST_INVALID',
    );
  },
);

it.each([
  'missing',
  'ambiguous',
  'invalid-json',
  'wrong-source',
  'wrong-task',
  'wrong-version',
  'wrong-page',
  'duplicate-line',
  'foreign-boundary',
  'foreign-callout',
])(
  'refuses %s public authority instead of falling back to broad limits',
  (change) => {
    const { result, part, view } = projected();
    if (change === 'wrong-source') view.source_sha256 = 'f'.repeat(64);
    if (change === 'wrong-task') view.task_id = 'foreign';
    if (change === 'wrong-version')
      view.schema_version = 'ava-native-structure-task-1';
    if (change === 'wrong-page') view.page_number = nativeTask2.page_number + 1;
    if (change === 'duplicate-line')
      view.lines = [nativeTask2.lines[0], nativeTask2.lines[0]];
    if (change === 'foreign-boundary')
      view.boundaries = [
        { ...nativeTask2.boundaries[0], left_line_id: 'foreign' },
      ];
    if (change === 'foreign-callout')
      view.eligible_callouts = [
        { ...nativeTask2.eligible_callouts[0], line_id: 'foreign' },
      ];
    part.text = change === 'invalid-json' ? '{' : JSON.stringify(view);
    if (change === 'missing') result.messages.pop();
    if (change === 'ambiguous')
      result.messages.push(structuredClone(result.messages[1]));
    expect(() => providerResponseSchema(model, result)).toThrow(
      'PDF_PROVIDER_REQUEST_INVALID',
    );
  },
);
