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

it('requires observed style identity, size and weight in host and Gemini grammar', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(providerResponseSchema('google/gemini-3.8-flash', task));
  const regular = { id: 'observed', relative_size: 1, bold: false };
  const styles: Record<string, unknown>[] = [
    { ...regular, id: 'style-ch1' },
    { ...regular, relative_size: null },
    { ...regular, bold: null },
    { id: 'observed', bold: false },
    { id: 'observed', relative_size: 1 },
    { relative_size: 1, bold: false },
  ];
  for (const style of styles) {
    const response = {
      ...refinementResponse,
      decisions: [{ ...refinementResponse.decisions[0], style }],
    };
    expect(validate(response)).toBe(false);
    expect(() => validatePacket('BookRefinementResponse', response)).toThrow(
      'INVALID_RESULT',
    );
  }
  const response = {
    ...refinementResponse,
    decisions: [{ ...refinementResponse.decisions[0], style: regular }],
  };
  expect(validate(response)).toBe(true);
  expect(validatePacket('BookRefinementResponse', response)).toEqual(response);
});
