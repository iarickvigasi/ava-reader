import Ajv2020 from 'ajv/dist/2020';
import taskFixture from './fixtures/source-role-task.json';
import response from './fixtures/source-role-response.json';
import type { SourceRoleTask } from './generated/SourceRoleTask';
import { refinementProviderTask } from './refinement-provider-task';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { geminiRecognitionSchema } from '../../library/pdf-import/providers/gemini-schema';
import { route } from '../../library/pdf-import/providers/test-fixtures';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import { checksumBuffer } from '../../shared/blob-utils';

const sourceTask = taskFixture as SourceRoleTask;
const task = refinementProviderTask(sourceTask, sourceTask.source_sha256);
const configured = {
  ...route,
  modelId: 'google/gemini-contract-control',
  configuration: {
    ...(route.configuration as object),
    promptHashes: {
      [task.promptVersion]: checksumBuffer(
        Buffer.from(task.messages[0].content as string),
      ),
    },
    schemaHashes: { [task.schemaVersion]: jsonHash(task.responseSchema) },
  },
};

it('uses the registered canonical schema and actual immutable Gemini request path', () => {
  const before = JSON.stringify(task);
  const schema = providerResponseSchema(configured.modelId, task);
  expect(schema).toEqual(
    geminiRecognitionSchema(task.responseSchema, task.schemaVersion),
  );
  expect(JSON.stringify(schema)).not.toMatch(/"\$(?:defs|ref)"/);
  const accepts = new Ajv2020({
    strict: false,
    validateFormats: false,
  }).compile(schema);
  expect(accepts(response)).toBe(true);
  const prepared = prepareProviderRequest(configured, task);
  const body = JSON.parse(prepared.request.toString()) as {
    messages: unknown;
    response_format: { json_schema: { schema: unknown } };
  };
  expect(body.response_format.json_schema.schema).toEqual(schema);
  expect(body.messages).toEqual(task.messages);
  expect(prepared.requestSha256).toBe(jsonHash(body));
  expect(
    prepareProviderRequest(configured, structuredClone(task)).requestSha256,
  ).toBe(prepared.requestSha256);
  expect(JSON.stringify(task)).toBe(before);
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
});

it('refuses a changed canonical schema even if a route is configured to that changed hash', () => {
  const changed = {
    ...task,
    responseSchema: { ...task.responseSchema, description: 'foreign schema' },
  };
  const altered = {
    ...configured,
    configuration: {
      ...configured.configuration,
      schemaHashes: { [task.schemaVersion]: jsonHash(changed.responseSchema) },
    },
  };
  expect(() => prepareProviderRequest(altered, changed)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
  expect(() => prepareProviderRequest(route, task)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
});
