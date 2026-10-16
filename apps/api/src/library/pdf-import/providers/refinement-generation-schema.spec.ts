import Ajv2020 from 'ajv/dist/2020';
import {
  refinementTask,
  refinementResponse,
} from '../../../pdf-conversion/reconstruction/refinement-fixture';
import { refinementProviderTask } from '../../../pdf-conversion/reconstruction/refinement-provider-task';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';
import { providerResponseSchema } from './response-schema';
import { jsonHash } from './hash';
import type { BookRefinementTask } from '../../../pdf-conversion/reconstruction/generated/BookRefinementTask';

function mixed(): BookRefinementTask {
  const node = refinementTask.nodes[0],
    crop = refinementTask.crops[0];
  return {
    ...structuredClone(refinementTask),
    prompt_version: 'ava-book-refinement-6',
    nodes: [
      { ...node, id: 'ocr', structure_candidate: false },
      {
        ...node,
        id: 'native',
        structure_candidate: true,
        candidate_original_kind: 'heading',
      },
      {
        ...node,
        id: 'context',
        structure_candidate: true,
        candidate_original_kind: 'heading',
      },
    ],
    decision_ids: ['ocr', 'native'],
    crops: [
      { ...crop, id: 'crop-ocr', node_id: 'ocr' },
      ...['native', 'context'].map((id) => ({
        ...crop,
        id: 'crop-' + id,
        node_id: id,
      })),
    ],
  };
}
function setup(input = mixed()) {
  const task = refinementProviderTask(input, input.source_sha256);
  const schema = providerResponseSchema('google/gemini-3.8-flash', task);
  return {
    task,
    schema,
    accepts: new Ajv2020({ strict: true, validateFormats: false }).compile(
      schema,
    ),
  };
}
function response() {
  const decision = refinementResponse.decisions[0];
  return {
    ...structuredClone(refinementResponse),
    decisions: [
      {
        ...decision,
        node_id: 'ocr',
        evidence_ids: ['crop-ocr'],
        role_kind: null,
      },
      {
        ...decision,
        node_id: 'native',
        evidence_ids: ['crop-native'],
        role_kind: 'heading',
        style: null,
      },
    ],
  };
}
it('rejects the observed native-for-OCR failure while retaining both legitimate forms', () => {
  const { accepts, task } = setup(),
    valid = response();
  expect(accepts(valid)).toBe(true);
  expect(validatePacket('BookRefinementResponse', valid)).toEqual(valid);
  const invalid = structuredClone(valid);
  invalid.decisions[0] = {
    ...invalid.decisions[0],
    role_kind: 'heading',
    style: null,
  };
  // Historical canonical parsing deliberately remains permissive; installed semantic
  // validation rejects this cross-owner shape. Generation now prevents it earlier.
  expect(validatePacket('BookRefinementResponse', invalid)).toEqual(invalid);
  expect(accepts(invalid)).toBe(false);
  const nativeStyle = structuredClone(valid);
  nativeStyle.decisions[1] = { ...nativeStyle.decisions[0], node_id: 'native' };
  expect(accepts(nativeStyle)).toBe(false);
  for (const id of ['context', 'outside']) {
    const wrong = structuredClone(valid);
    wrong.decisions[0].node_id = id;
    expect(accepts(wrong)).toBe(false);
  }
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
});
it.each([true, false])(
  'keeps single-authority tasks valid (native=%s)',
  (native) => {
    const input = mixed();
    input.decision_ids = [native ? 'native' : 'ocr'];
    const { accepts, schema } = setup(input);
    const valid = response();
    valid.decisions = [valid.decisions[native ? 1 : 0]];
    expect(accepts(valid)).toBe(true);
    expect(JSON.stringify(schema)).not.toContain('"enum":[]');
    valid.decisions[0].node_id = native ? 'ocr' : 'native';
    expect(accepts(valid)).toBe(false);
  },
);
it('uses canonical false default and keeps metadata-only historical generation bytes', () => {
  const input = mixed();
  delete input.nodes[0].structure_candidate;
  expect(setup(input).accepts(response())).toBe(true);
  input.decision_ids = [];
  input.metadata_ids = ['ocr'];
  input.prompt_version = 'ava-book-refinement-4';
  const { schema, task } = setup(input);
  expect(schema).toEqual(
    geminiRecognitionSchema(task.responseSchema, task.schemaVersion),
  );
});
it('refuses altered public context, bindings, flags, membership and duplicate IDs', () => {
  const { task } = setup();
  for (const change of [
    (x: Record<string, unknown>) => {
      x.source_sha256 = 'd'.repeat(64);
    },
    (x: Record<string, unknown>) => {
      x.task_id = 'other';
    },
    (x: Record<string, unknown>) => {
      x.prompt_version = 'ava-book-refinement-5';
    },
    (x: Record<string, unknown>) => {
      x.image_sha256 = 'd'.repeat(64);
    },
    (x: Record<string, unknown>) => {
      x.required_decision_evidence = {};
    },
    (x: Record<string, unknown>) => {
      x.evidence_instruction = 'changed';
    },
    (x: Record<string, unknown>) => {
      x.decision_ids = ['outside'];
    },
    (x: Record<string, unknown>) => {
      x.decision_ids = ['ocr', 'ocr'];
    },
    (x: Record<string, unknown>) => {
      const nodes = x.nodes as Record<string, unknown>[];
      nodes[1].id = nodes[0].id;
    },
    (x: Record<string, unknown>) => {
      (x.nodes as Record<string, unknown>[])[0].structure_candidate = null;
    },
    (x: Record<string, unknown>) => {
      (x.nodes as Record<string, unknown>[])[0].structure_candidate = 'false';
    },
  ]) {
    const changed = structuredClone(task),
      content = changed.messages[1].content;
    if (typeof content === 'string' || content[0].type !== 'text')
      throw Error('fixture');
    const context = JSON.parse(content[0].text) as Record<string, unknown>;
    change(context);
    content[0].text = JSON.stringify(context);
    expect(() =>
      providerResponseSchema('google/gemini-3.8-flash', changed),
    ).toThrow();
  }
  for (const changed of [
    { ...task, pageIndices: [4] },
    { ...task, purpose: 'recognize_region' as typeof task.purpose },
    { ...task, messages: [...task.messages, task.messages[1]] },
  ])
    expect(() =>
      providerResponseSchema('google/gemini-3.8-flash', changed),
    ).toThrow();
});
it('does not mutate the input task or canonical schema', () => {
  const task = refinementProviderTask(mixed(), refinementTask.source_sha256),
    before = jsonHash(task);
  providerResponseSchema('google/gemini-3.8-flash', task);
  expect(jsonHash(task)).toBe(before);
});
