import Ajv2020 from 'ajv/dist/2020';
import {
  continuationTask,
  continuationResponse,
} from '../../../pdf-conversion/reconstruction/continuation-fixture';
import { refinementProviderTask } from '../../../pdf-conversion/reconstruction/refinement-provider-task';
import { refinementResponse } from '../../../pdf-conversion/reconstruction/refinement-response';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { providerResponseSchema } from './response-schema';
import { jsonHash } from './hash';

function fixture() {
  const task = refinementProviderTask(
    continuationTask,
    continuationTask.source_sha256,
  );
  const schema = providerResponseSchema('google/gemini-3.8-flash', task);
  return {
    task,
    schema,
    accepts: new Ajv2020({ strict: true, validateFormats: false }).compile(
      schema,
    ),
  };
}
it('offers only exact source candidates and bounded OCR delegation without rewriting canonical responses', () => {
  const { task, accepts, schema } = fixture();
  const before = jsonHash(task);
  expect(accepts(continuationResponse)).toBe(true);
  expect(
    refinementResponse(continuationTask, JSON.stringify(continuationResponse)),
  ).toEqual(continuationResponse);
  const observed = structuredClone(continuationResponse);
  observed.decisions[0].style = {
    id: 'observed',
    relative_size: 1,
    bold: false,
  };
  observed.presentations[0] = {
    ...observed.presentations[0],
    candidate_id: null,
    evidence_ids: [],
  };
  observed.joins[0].join = false;
  expect(accepts(observed)).toBe(true);
  for (const change of [
    (value: typeof observed) => {
      value.decisions[0].node_id = 'left';
    },
    (value: typeof observed) => {
      value.decisions[0].role_kind = 'heading';
    },
    (value: typeof observed) => {
      value.presentations[0].candidate_id = 'foreign';
    },
    (value: typeof observed) => {
      value.presentations[0].edge_id = 'foreign';
    },
  ]) {
    const invalid = structuredClone(observed);
    change(invalid);
    expect(accepts(invalid)).toBe(false);
  }
  expect(JSON.stringify(schema)).not.toContain('"enum":[]');
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
  expect(jsonHash(task)).toBe(before);
  expect(() =>
    validatePacket('BookRefinementResponse', continuationResponse),
  ).toThrow();
});
it('requires the exact factory-produced prompt, candidate catalogue and evidence maps', () => {
  const { task } = fixture();
  for (const change of [
    (value: Record<string, unknown>) => {
      value.required_presentation_evidence = {};
    },
    (value: Record<string, unknown>) => {
      value.native_endpoints = null;
    },
    (value: Record<string, unknown>) => {
      value.join_candidates = [];
    },
  ]) {
    const altered = structuredClone(task);
    const content = altered.messages[1].content;
    if (typeof content === 'string' || content[0].type !== 'text')
      throw Error('fixture');
    const data = JSON.parse(content[0].text) as Record<string, unknown>;
    change(data);
    content[0].text = JSON.stringify(data);
    expect(() =>
      providerResponseSchema('google/gemini-3.8-flash', altered),
    ).toThrow();
  }
  const changedPrompt = structuredClone(task);
  changedPrompt.messages[0].content = 'changed';
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', changedPrompt),
  ).toThrow();
});
