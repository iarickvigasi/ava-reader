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
import { recognitionRequestGrammar } from './recognition-request-grammar-fixture';
import {
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
    const schema = recognitionRequestGrammar(
      configured.modelId,
      provider,
      encoded.request,
    ) as {
      $defs: Record<string, SchemaShape & { allOf: SchemaShape[] }>;
    };
    const definitions = schema.$defs;
    for (const owner of [
      definitions.RecognitionSegment.allOf[0],
      definitions.RecognitionCell,
    ]) {
      expect(props(owner).text.description).toContain(
        'before quoting any span',
      );
      expect(props(owner).text.description).toContain(
        'intrinsic Unicode stays exact',
      );
      expect(props(owner).spans.items).toEqual({
        $ref: '#/$defs/RecognitionSpan',
      });
    }
    const anchor = props(definitions.RecognitionTextAnchor);
    expect(anchor.exact_text.description).toContain('Copy verbatim');
    expect(anchor.exact_text.description).toContain('exactly one occurrence');
    expect(anchor.before.description).toContain(
      'immediately adjacent preceding',
    );
    expect(anchor.after.description).toContain(
      'immediately adjacent following',
    );
    expect(encoded.taskSha256).toBe(jsonHash(provider));
    expect(encoded.requestSha256).toBe(checksumBuffer(encoded.request));
    expect(GEMINI_GRAMMAR_VERSION).toBe('ava-gemini-recognition-grammar-9');
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
