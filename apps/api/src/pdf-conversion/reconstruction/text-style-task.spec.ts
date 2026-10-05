import { providerTask } from './provider-task';
import { task } from './test-fixture';
import {
  TEXT_STYLE_PROMPT,
  PINNED_TEXT_STYLE_PROMPT,
  ORDERED_LIST_PROMPT,
  PINNED_ORDERED_LIST_PROMPT,
} from './generated/prompt';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { route } from '../../library/pdf-import/providers/test-fixtures';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import { checksumBuffer } from '../../shared/blob-utils';
import { GEMINI_GRAMMAR_VERSION } from '../../library/pdf-import/providers/response-schema';
import {
  anchorProperties,
  properties as props,
  type SchemaShape,
} from './text-style-schema-fixture';

it.each([
  ['ava-prose-region-15', TEXT_STYLE_PROMPT, ORDERED_LIST_PROMPT],
  ['ava-prose-region-16', PINNED_TEXT_STYLE_PROMPT, PINNED_ORDERED_LIST_PROMPT],
] as const)(
  'dispatches %s with bound text-first instructions and unchanged source evidence',
  (version, prompt, prior) => {
    const provider = providerTask(
      { ...task, prompt_version: version },
      task.source_sha256,
      1,
    );
    expect(provider.messages[0]).toEqual({ role: 'system', content: prompt });
    expect(prompt.startsWith(prior)).toBe(true);
    const context = provider.messages[1].content;
    if (typeof context === 'string' || context[0].type !== 'text')
      throw new Error('Missing source context');
    expect(JSON.parse(context[0].text)).toMatchObject({
      source_sha256: task.source_sha256,
      native_evidence: task.native_evidence,
      native_evidence_sha256: task.native_evidence_sha256,
    });
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
        json_schema: { strict: boolean; schema: SchemaShape };
      };
    };
    expect(body.messages).toEqual(provider.messages);
    expect(body.response_format.json_schema.strict).toBe(true);
    const segment = props(body.response_format.json_schema.schema).segments
      .items!;
    const cell = props(segment).cells.items!.items!;
    for (const owner of [segment, cell]) {
      expect(props(owner).text.description).toContain(
        'before quoting any span',
      );
      expect(props(owner).text.description).toContain(
        'intrinsic Unicode stays exact',
      );
      const anchor = anchorProperties(owner);
      expect(anchor.exact_text.description).toContain('Copy verbatim');
      expect(anchor.exact_text.description).toContain('exactly one occurrence');
      expect(anchor.before.description).toContain(
        'immediately adjacent preceding',
      );
      expect(anchor.after.description).toContain(
        'immediately adjacent following',
      );
    }
    expect(encoded.taskSha256).toBe(jsonHash(provider));
    expect(encoded.requestSha256).toBe(checksumBuffer(encoded.request));
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
