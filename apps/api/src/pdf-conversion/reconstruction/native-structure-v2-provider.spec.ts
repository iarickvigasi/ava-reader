import Ajv from 'ajv';
import { checksumBuffer } from '../../shared/blob-utils';
import { nativeTask2, nativeResponse2 } from './native-structure-v2-fixture';
import { nativeStructure2ProviderTask } from './native-structure-v2-provider-task';
import { NATIVE_STRUCTURE_V2_PROMPT } from './generated/native-structure-v2-prompt';
import { recognitionSchemas } from './generated/schemas';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import {
  providerResponseSchema,
  GEMINI_GRAMMAR_VERSION,
} from '../../library/pdf-import/providers/response-schema';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import {
  route,
  config,
} from '../../library/pdf-import/providers/test-fixtures';

const task = nativeStructure2ProviderTask(
  nativeTask2,
  nativeTask2.source_sha256,
  nativeTask2.page_number,
);
const configuration = {
  ...config,
  promptHashes: {
    'ava-native-structure-2': checksumBuffer(
      Buffer.from(NATIVE_STRUCTURE_V2_PROMPT),
    ),
  },
  schemaHashes: {
    'ava-native-structure-response-2': jsonHash(
      recognitionSchemas.NativeStructureResponse2,
    ),
  },
};
const captured = {
  ...route,
  modelId: 'google/gemini-contract-control',
  configuration,
};

it('pins the new prompt/canonical schema and sends the actual closed lowered grammar with unchanged request ceiling', () => {
  const prepared = prepareProviderRequest(captured, task);
  const body = JSON.parse(prepared.request.toString()) as {
    max_tokens: number;
    stream: boolean;
    plugins: unknown[];
    transforms: unknown[];
    response_format: { json_schema: { strict: boolean; schema: object } };
    provider: { allow_fallbacks: boolean; only: string[] };
  };
  expect(GEMINI_GRAMMAR_VERSION).toBe('ava-gemini-recognition-grammar-3');
  expect(body).toMatchObject({
    max_tokens: configuration.maxOutputTokens,
    stream: false,
    plugins: [],
    transforms: [],
    provider: { allow_fallbacks: false, only: [route.providerSlug] },
  });
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.response_format.json_schema.schema).toEqual(
    providerResponseSchema(captured.modelId, task),
  );
  const valid = new Ajv({ strict: false }).compile(
    body.response_format.json_schema.schema,
  );
  expect(valid(nativeResponse2)).toBe(true);
  expect(
    valid({
      ...nativeResponse2,
      groups: nativeResponse2.groups.map((g) => ({
        ...g,
        chapter_role: 'bodymatter',
      })),
    }),
  ).toBe(false);
  expect(prepared.requestSha256).toBe(checksumBuffer(prepared.request));
  expect(prepared.taskSha256).toBe(jsonHash(task));
  expect(task.maxOutputTokens).toBeUndefined();
  expect(providerResponseSchema(route.modelId, task)).toBe(task.responseSchema);
});
it.each(['old-prompt', 'old-schema', 'forged-schema'])(
  'refuses %s authorization before request delivery',
  (change) => {
    const changed = structuredClone(task);
    if (change === 'old-prompt')
      changed.promptVersion = 'ava-native-structure-1';
    if (change === 'old-schema')
      changed.schemaVersion = 'ava-native-structure-response-1';
    if (change === 'forged-schema')
      changed.responseSchema = recognitionSchemas.NativeStructureResponse;
    expect(() => prepareProviderRequest(captured, changed)).toThrow(
      'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
    );
  },
);
