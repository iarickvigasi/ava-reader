import {
  anchorParent,
  anchorOriginal,
  anchorTask,
  anchorResponse,
} from './anchor-context-fixture';
import {
  anchorContextBinding,
  contextSha,
  contextTaskId,
} from './anchor-context-binding';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { anchorContextResponse } from './anchor-context-response';
import { ANCHOR_CONTEXT_PROMPT } from './generated/anchor-context-prompt';
import { recognitionSchemas } from './generated/schemas';
import { recognitionResponse } from './recognition-response';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { route } from '../../library/pdf-import/providers/test-fixtures';
import { jsonHash } from '../../library/pdf-import/providers/hash';

it('binds the Python-authored context task to the exact original wire response and one source image', () => {
  expect(contextTaskId(anchorTask)).toBe(anchorTask.task_id);
  expect(
    anchorContextBinding(anchorTask, anchorParent, anchorOriginal),
  ).toEqual(anchorTask);
  const provider = anchorContextProviderTask(
    anchorTask,
    anchorParent,
    anchorOriginal,
  );
  expect(provider).toMatchObject({
    purpose: 'resolve_structure',
    taskId: 'anchor-context-parent-' + contextSha(anchorParent.task_id),
    promptVersion: 'ava-recognition-anchor-context-1',
    schemaVersion: 'ava-recognition-anchor-context-response-1',
  });
  expect(provider.messages[0]).toEqual({
    role: 'system',
    content: ANCHOR_CONTEXT_PROMPT,
  });
  expect(provider.responseSchema).toEqual(
    recognitionSchemas.RecognitionAnchorContextResponse,
  );
  expect(
    JSON.stringify(provider.messages).split('data:image/png;base64,'),
  ).toHaveLength(2);
  const configured = {
    ...route,
    modelId: 'google/gemini-contract-control',
    configuration: {
      ...(route.configuration as object),
      promptHashes: {
        [provider.promptVersion]: contextSha(ANCHOR_CONTEXT_PROMPT),
      },
      schemaHashes: {
        [provider.schemaVersion]: jsonHash(provider.responseSchema),
      },
    },
  };
  expect(() => prepareProviderRequest(route, provider)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
  expect(prepareProviderRequest(configured, provider).taskSha256).toBe(
    jsonHash(provider),
  );
  expect(() =>
    providerResponseSchema(configured.modelId, {
      ...provider,
      responseSchema: {},
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});

it('changes only adjacent context while retaining the original immutable quotation/style/text/geometry', () => {
  const before = JSON.stringify(anchorOriginal);
  const result = anchorContextResponse(
    anchorTask,
    JSON.stringify(anchorResponse),
    anchorParent,
    anchorOriginal,
  );
  expect(result.corrected).not.toBeNull();
  expect(JSON.stringify(anchorOriginal)).toBe(before);
  const restored = structuredClone(result.corrected!);
  for (const slot of anchorTask.slots)
    restored.segments[slot.segment_index].spans[slot.span_index].anchor =
      structuredClone(
        anchorOriginal.segments[slot.segment_index].spans[slot.span_index]
          .anchor,
      );
  expect(restored).toEqual(anchorOriginal);
  expect(
    recognitionResponse(anchorParent, JSON.stringify(result.corrected)),
  ).toEqual(result.corrected);
});

it.each([
  'task_id',
  'source_sha256',
  'render_sha256',
  'original_task_id',
  'original_response_sha256',
])('rejects a foreign correction response %s', (field) => {
  expect(() =>
    anchorContextResponse(
      anchorTask,
      JSON.stringify({ ...anchorResponse, [field]: 'f'.repeat(64) }),
      anchorParent,
      anchorOriginal,
    ),
  ).toThrow('SOURCE_MISMATCH');
});
it.each([
  'original_task_id',
  'source_sha256',
  'native_evidence_sha256',
  'render_sha256',
])('rejects a renewed task with foreign %s before dispatch', (field) => {
  const changed = { ...anchorTask, [field]: 'f'.repeat(64) };
  changed.task_id = contextTaskId(changed);
  expect(() =>
    anchorContextProviderTask(changed, anchorParent, anchorOriginal),
  ).toThrow('SOURCE_MISMATCH');
});
it.each(['text', 'style', 'box', 'anchor'])(
  'refuses an altered original %s even after renewing JSON hashes/task identity',
  (field) => {
    const changed = structuredClone(anchorTask),
      original = JSON.parse(
        changed.original_response_json,
      ) as typeof anchorOriginal;
    const slot = changed.slots[0],
      segment = original.segments[slot.segment_index];
    if (field === 'text') segment.text += ' private-document-control';
    if (field === 'style') segment.style = { id: 'replacement', italic: true };
    if (field === 'box') segment.box.x1 -= 1;
    if (field === 'anchor')
      segment.spans[slot.span_index].anchor!.exact_text += 'x';
    changed.original_response_json = JSON.stringify(original);
    changed.original_response_sha256 = contextSha(
      changed.original_response_json,
    );
    changed.task_id = contextTaskId(changed);
    expect(() =>
      anchorContextProviderTask(changed, anchorParent, anchorOriginal),
    ).toThrow('SOURCE_MISMATCH');
  },
);
it.each([
  'missing',
  'duplicate',
  'foreign',
  'still-ambiguous',
  'oversized',
  'replacement',
])(
  'refuses %s patches without dropping styling or widening quotation',
  (kind) => {
    const changed = structuredClone(anchorResponse);
    if (kind === 'missing') changed.patches.pop();
    if (kind === 'duplicate')
      changed.patches = [changed.patches[0], changed.patches[0]];
    if (kind === 'foreign') changed.patches[0].span_sha256 = 'f'.repeat(64);
    if (kind === 'still-ambiguous')
      changed.patches[0].before = changed.patches[0].after = '';
    if (kind === 'oversized') changed.patches[0].before = 'x'.repeat(129);
    if (kind === 'replacement')
      Object.assign(changed.patches[0], {
        style: { bold: false },
        exact_text: 'private bearer sk-secret',
      });
    try {
      anchorContextResponse(
        anchorTask,
        JSON.stringify(changed),
        anchorParent,
        anchorOriginal,
      );
      throw new Error('incorrectly accepted');
    } catch (error) {
      expect(['INVALID_RESULT', 'SOURCE_MISMATCH']).toContain(
        (error as Error).message,
      );
      expect(JSON.stringify(error)).not.toMatch(/private|bearer|sk-secret/);
    }
  },
);
it('forwards only a finite bound unresolved decision without a patched parent', () => {
  const unresolved = {
    ...anchorResponse,
    outcome: 'unresolved',
    patches: [],
    unresolved_reason: 'NO_UNIQUE_CONTEXT',
  };
  expect(
    anchorContextResponse(
      anchorTask,
      JSON.stringify(unresolved),
      anchorParent,
      anchorOriginal,
    ),
  ).toEqual({ response: unresolved, corrected: null });
  for (const change of [
    { patches: anchorResponse.patches },
    { unresolved_reason: null },
    { unresolved_reason: 'private reason' },
  ])
    expect(() =>
      anchorContextResponse(
        anchorTask,
        JSON.stringify({ ...unresolved, ...change }),
        anchorParent,
        anchorOriginal,
      ),
    ).toThrow('INVALID_RESULT');
});

it.each(['missing', 'duplicate', 'forged-span', 'image'])(
  'refuses %s task evidence after recomputing the declared task identity',
  (kind) => {
    const changed = structuredClone(anchorTask);
    if (kind === 'missing') changed.slots.pop();
    if (kind === 'duplicate') changed.slots[1] = changed.slots[0];
    if (kind === 'forged-span') {
      const span = JSON.parse(changed.slots[0].original_span_json) as Record<
        string,
        unknown
      >;
      span.style = { id: 'changed', bold: false };
      changed.slots[0].original_span_json = JSON.stringify(span);
      changed.slots[0].span_sha256 = contextSha(
        changed.slots[0].original_span_json,
      );
    }
    if (kind === 'image') changed.image.width++;
    changed.task_id = contextTaskId(changed);
    expect(() =>
      anchorContextProviderTask(changed, anchorParent, anchorOriginal),
    ).toThrow();
  },
);
