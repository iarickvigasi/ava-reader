import Ajv2020 from 'ajv/dist/2020';
import {
  refinementTask,
  refinementResponse,
} from '../../../pdf-conversion/reconstruction/refinement-fixture';
import {
  continuationTask,
  continuationResponse,
} from '../../../pdf-conversion/reconstruction/continuation-fixture';
import { refinementProviderTask } from '../../../pdf-conversion/reconstruction/refinement-provider-task';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { providerResponseSchema } from './response-schema';
import { jsonHash } from './hash';

it('constrains only source-designated OCR body references to unit size', () => {
  const input = structuredClone(refinementTask),
    heading = input.nodes[0];
  heading.body_reference_id = 'body';
  input.nodes.push({
    ...heading,
    id: 'body',
    kind: 'paragraph',
    body_reference_id: null,
    observed_level: null,
    observed_chapter: false,
    observed_role: null,
  });
  input.decision_ids.push('body');
  // A catalogue reference to a heading must not force its visual heading size.
  input.nodes[1].body_reference_id = 'heading';
  input.crops.push({ ...input.crops[0], id: 'crop-body', node_id: 'body' });
  const task = refinementProviderTask(input, input.source_sha256),
    before = jsonHash(task);
  const schema = providerResponseSchema('google/gemini-3.8-flash', task);
  const accepts = new Ajv2020({ strict: true, validateFormats: false }).compile(
    schema,
  );
  const valid = structuredClone(refinementResponse);
  valid.decisions[0].evidence_ids.push('crop-body');
  valid.decisions.push({
    node_id: 'body',
    text_sha256: heading.text_sha256,
    evidence_ids: ['crop-body'],
    role_kind: null,
    heading_level: null,
    parent_id: null,
    chapter_start: null,
    chapter_role: null,
    style: { id: 'observed', relative_size: 1, bold: false },
  });
  expect(accepts(valid)).toBe(true);
  const invalid = structuredClone(valid);
  invalid.decisions[1].style!.relative_size = 0.95;
  expect(validatePacket('BookRefinementResponse', invalid)).toEqual(invalid);
  expect(accepts(invalid)).toBe(false);
  // Heading sizes remain visual judgments rather than forced body defaults.
  valid.decisions[0].style!.relative_size = 0.95;
  expect(accepts(valid)).toBe(true);
  expect(JSON.stringify(schema)).not.toContain('"enum":[]');
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
  expect(jsonHash(task)).toBe(before);
});

it('preserves finite source delegation while constraining explicit body styles', () => {
  const input = structuredClone(continuationTask);
  input.nodes[0].body_reference_id = 'right';
  const task = refinementProviderTask(input, input.source_sha256),
    before = jsonHash(task);
  const schema = providerResponseSchema('google/gemini-3.8-flash', task);
  const accepts = new Ajv2020({ strict: true, validateFormats: false }).compile(
    schema,
  );
  const delegated = structuredClone(continuationResponse);
  expect(delegated.decisions[0].style).toBeNull();
  expect(accepts(delegated)).toBe(true);
  delegated.decisions[0].style = {
    id: 'observed',
    relative_size: 1,
    bold: false,
  };
  expect(accepts(delegated)).toBe(true);
  delegated.decisions[0].style.relative_size = 0.95;
  expect(accepts(delegated)).toBe(false);
  expect(validatePacket('PresentationRefinementResponse', delegated)).toEqual(
    delegated,
  );
  expect(jsonHash(task)).toBe(before);
});
