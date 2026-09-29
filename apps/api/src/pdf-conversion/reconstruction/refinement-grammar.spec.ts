import Ajv2020 from 'ajv/dist/2020';
import { refinementProviderTask } from './refinement-provider-task';
import { refinementTask, refinementResponse } from './refinement-fixture';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { validatePacket } from './validate-packet';

it('lowers only the exact fixed refinement schema for Gemini generation', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  const grammar = providerResponseSchema('google/gemini-3.8-flash', task);
  expect(JSON.stringify(grammar)).not.toMatch(/"(?:allOf|\$ref|\$defs)"/);
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(grammar);
  expect(validate(refinementResponse)).toBe(true);
  expect(validatePacket('BookRefinementResponse', refinementResponse)).toEqual(
    refinementResponse,
  );
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', {
      ...task,
      responseSchema: {},
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it('preserves other provider schemas and rejects changed source images', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
  expect(() =>
    refinementProviderTask(
      {
        ...refinementTask,
        image: { ...refinementTask.image, sha256: '0'.repeat(64) },
      },
      refinementTask.source_sha256,
    ),
  ).toThrow('SOURCE_MISMATCH');
});
