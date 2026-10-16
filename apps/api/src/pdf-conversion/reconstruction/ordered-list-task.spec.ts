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
import { recognitionRequestGrammar } from './recognition-request-grammar-fixture';

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
    const schema = recognitionRequestGrammar(
      configured.modelId,
      provider,
      encoded.request,
    ) as {
      $defs: {
        RecognitionSegment: {
          allOf: {
            properties?: Record<string, unknown>;
            anyOf?: {
              properties: {
                kind?: { enum: string[] };
                list_ordered?: { type: string };
                list_start?: { type: string };
              };
              required?: string[];
            }[];
          }[];
        };
      };
    };
    const [segment, kinds, , ordered] = schema.$defs.RecognitionSegment.allOf;
    expect(
      (segment.properties!.list_start as { anyOf: unknown[] }).anyOf,
    ).toContainEqual({ type: 'null' });
    const list = kinds.anyOf!.find((branch) =>
      branch.properties.kind?.enum.includes('list_item'),
    )!;
    expect(list.properties.list_ordered?.type).toBe('boolean');
    expect(list.required).toEqual(
      expect.arrayContaining(['list_depth', 'list_ordered']),
    );
    expect(ordered.anyOf![1].properties.list_start?.type).toBe('integer');
    expect(ordered.anyOf![1].required).toContain('list_start');
    expect(prompt).toContain('including nested items');
    expect(prompt).toContain('Roman numerals');
    expect(encoded.taskSha256).toBe(jsonHash(provider));
    expect(GEMINI_GRAMMAR_VERSION).toBe('ava-gemini-recognition-grammar-6');
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
