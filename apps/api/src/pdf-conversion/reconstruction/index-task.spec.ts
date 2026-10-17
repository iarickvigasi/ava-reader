import { INDEX_PROMPT, TEXT_STYLE_PROMPT } from './generated/prompt';
import { providerTask } from './provider-task';
import { task } from './test-fixture';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { route } from '../../library/pdf-import/providers/test-fixtures';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import { checksumBuffer } from '../../shared/blob-utils';

it('binds index structure instructions, pixels and evidence to the dispatched request', () => {
  const input = {
    ...task,
    purpose: 'pdf_structure_repair' as const,
    prompt_version: 'ava-prose-region-17' as const,
  };
  const provider = providerTask(input, input.source_sha256, 1);
  expect(provider.purpose).toBe('resolve_structure');
  expect(provider.messages[0]).toEqual({
    role: 'system',
    content: INDEX_PROMPT,
  });
  expect(INDEX_PROMPT.startsWith(TEXT_STYLE_PROMPT)).toBe(true);
  const content = provider.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw new Error('Missing exact source context');
  expect(JSON.parse(content[0].text)).toMatchObject({
    task_id: input.task_id,
    native_evidence: input.native_evidence,
    native_evidence_sha256: input.native_evidence_sha256,
    render_sha256: input.image.sha256,
  });
  const configured = {
    ...route,
    configuration: {
      ...(route.configuration as object),
      promptHashes: {
        [input.prompt_version]: checksumBuffer(Buffer.from(INDEX_PROMPT)),
      },
      schemaHashes: {
        [provider.schemaVersion]: jsonHash(provider.responseSchema),
      },
    },
  };
  const encoded = prepareProviderRequest(configured, provider);
  expect(encoded.taskSha256).toBe(jsonHash(provider));
  expect(encoded.requestSha256).toBe(checksumBuffer(encoded.request));
  expect(() =>
    prepareProviderRequest(
      {
        ...configured,
        configuration: {
          ...configured.configuration,
          promptHashes: {
            [input.prompt_version]: checksumBuffer(
              Buffer.from(TEXT_STYLE_PROMPT),
            ),
          },
        },
      },
      provider,
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
