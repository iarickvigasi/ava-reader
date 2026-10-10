import { providerTask } from './provider-task';
import { task } from './test-fixture';
import {
  ORDERED_LIST_PROMPT,
  PINNED_ORDERED_LIST_PROMPT,
  UNICODE_STYLE_PROMPT,
  PINNED_UNICODE_PROMPT,
} from './generated/prompt';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { route } from '../../library/pdf-import/providers/test-fixtures';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import { checksumBuffer } from '../../shared/blob-utils';
import { GEMINI_GRAMMAR_VERSION } from '../../library/pdf-import/providers/response-schema';

it.each([
  ['ava-prose-region-13', ORDERED_LIST_PROMPT, UNICODE_STYLE_PROMPT],
  ['ava-prose-region-14', PINNED_ORDERED_LIST_PROMPT, PINNED_UNICODE_PROMPT],
] as const)(
  'dispatches source-bound %s with the authorized new instructions',
  (version, prompt, prior) => {
    const provider = providerTask(
      { ...task, prompt_version: version },
      task.source_sha256,
      1,
    );
    expect(provider.promptVersion).toBe(version);
    expect(provider.messages[0]).toEqual({ role: 'system', content: prompt });
    expect(prompt.startsWith(prior)).toBe(true);
    expect(prompt).toContain('a. -> 1, b. -> 2');
    const configured = {
      ...route,
      modelId: 'google/gemini-3.8-flash',
      providerSlug: 'google-vertex',
      configuration: {
        ...(route.configuration as object),
        promptHashes: { [version]: checksumBuffer(Buffer.from(prompt)) },
        schemaHashes: {
          [provider.schemaVersion]: jsonHash(provider.responseSchema),
        },
      },
    };
    const encoded = prepareProviderRequest(configured, provider);
    const body = JSON.parse(encoded.request.toString()) as {
      messages: unknown;
      response_format: {
        json_schema: {
          strict: boolean;
          schema: {
            properties: {
              segments: {
                items: {
                  properties: {
                    list_start: { description: string; anyOf: unknown[] };
                    list_ordered: { description: string };
                  };
                };
              };
            };
          };
        };
      };
    };
    expect(body.messages).toEqual(provider.messages);
    expect(body.response_format.json_schema.strict).toBe(true);
    const properties =
      body.response_format.json_schema.schema.properties.segments.items
        .properties;
    expect(properties.list_start.description).toContain('a/b=1/2');
    expect(properties.list_start.description).toContain('continued items');
    expect(properties.list_start.anyOf).toContainEqual({ type: 'null' });
    expect(properties.list_ordered.description).toContain('Roman');
    expect(encoded.taskSha256).toBe(jsonHash(provider));
    expect(GEMINI_GRAMMAR_VERSION).toBe('ava-gemini-recognition-grammar-3');
    const stale = {
      ...configured,
      configuration: {
        ...configured.configuration,
        promptHashes: { [version]: checksumBuffer(Buffer.from(prior)) },
      },
    };
    expect(() => prepareProviderRequest(stale, provider)).toThrow(
      'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
    );
  },
);
