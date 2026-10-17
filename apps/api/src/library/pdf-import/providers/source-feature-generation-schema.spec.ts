import Ajv2020 from 'ajv/dist/2020';
import {
  featureTask,
  featureResponse,
} from '../../../pdf-conversion/reconstruction/source-feature-contract-fixture';
import { refinementProviderTask } from '../../../pdf-conversion/reconstruction/refinement-provider-task';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { providerResponseSchema } from './response-schema';
import { jsonHash } from './hash';

function setup() {
  const task = refinementProviderTask(featureTask, featureTask.source_sha256);
  const schema = providerResponseSchema('google/gemini-3.8-flash', task);
  return {
    task,
    schema,
    accepts: new Ajv2020({ strict: true, validateFormats: false }).compile(
      schema,
    ),
  };
}
function changed(
  feature: string,
  value: unknown,
  disposition = 'observed',
  reason: string | null = null,
) {
  const response = structuredClone(featureResponse);
  const field = response.feature_decisions[0].features.find(
    (f) => f.feature === feature,
  )!;
  Object.assign(field, { value, disposition, reason });
  return response;
}

it('rejects the paid 14.5-em column-as-indent error before generating an invalid style', () => {
  const { accepts, task } = setup();
  const invalid = changed('block_inset', 14.5);
  expect(accepts(featureResponse)).toBe(true);
  expect(validatePacket('SourceFeatureResponse', invalid)).toEqual(invalid);
  expect(accepts(invalid)).toBe(false);
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
});

it.each([
  ['block_inset', 0, true],
  ['block_inset', 6, true],
  ['block_inset', -0.01, false],
  ['block_inset', 6.01, false],
  ['first_line_indent', -3, true],
  ['first_line_indent', 6, true],
  ['first_line_indent', -3.01, false],
  ['relative_size', 0.5, true],
  ['relative_size', 3, true],
  ['relative_size', 0.49, false],
  ['relative_size', 3.01, false],
  ['weight', false, true],
  ['italic', false, true],
  ['weight', 0, false],
  ['italic', 'false', false],
  ['family', 'serif', true],
  ['family', 'invented', false],
  ['paragraph_role', 'paragraph', true],
  ['paragraph_role', 'heading', false],
  ['block_inset', null, false],
  ['relative_size', true, false],
])(
  'keeps worker-compatible observed %s=%s (accepted=%s)',
  (feature, value, expected) => {
    expect(setup().accepts(changed(feature, value))).toBe(expected);
  },
);

it('preserves honest unknown values without clamping or widening role authority', () => {
  const { accepts, schema } = setup();
  expect(
    accepts(
      changed('block_inset', null, 'unknown', 'source_context_insufficient'),
    ),
  ).toBe(true);
  expect(accepts(changed('weight', null, 'unknown', 'source_blurred'))).toBe(
    true,
  );
  expect(
    accepts(changed('paragraph_role', null, 'unknown', 'source_clipped')),
  ).toBe(true);
  expect(
    accepts(
      changed('block_inset', 6, 'unknown', 'source_context_insufficient'),
    ),
  ).toBe(false);
  expect(accepts(changed('block_inset', null, 'unknown', null))).toBe(false);
  expect(
    accepts(
      changed(
        'block_inset',
        null,
        'not_applicable',
        'heading_has_no_prose_first_line',
      ),
    ),
  ).toBe(false);
  expect(schema.description).toEqual(expect.stringContaining('Never clamp'));
  expect(schema.description).toEqual(
    expect.stringContaining('A second column is not'),
  );
});

it('binds generation to the exact factory task, requested nodes and evidence maps', () => {
  const { task, accepts } = setup();
  const foreign = structuredClone(featureResponse);
  foreign.feature_decisions[0].node_id = 'body';
  expect(accepts(foreign)).toBe(false);
  const altered = structuredClone(task),
    content = altered.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw Error('fixture');
  const context = JSON.parse(content[0].text) as Record<string, unknown>;
  context.required_feature_evidence = {};
  content[0].text = JSON.stringify(context);
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', altered),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  const before = jsonHash(task);
  providerResponseSchema('google/gemini-3.8-flash', task);
  expect(jsonHash(task)).toBe(before);
});
