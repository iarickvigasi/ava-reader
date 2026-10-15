import {
  quoteParent,
  quoteOriginal,
  quoteTask,
  quoteResponse,
} from './anchor-quote-fixture';
import {
  anchorQuoteBinding,
  anchorContextBinding,
  contextSha,
  anchorMatches,
} from './anchor-context-binding';
import { allowedQuotations, quoteTaskId } from './anchor-quote-candidates';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { anchorContextResponse } from './anchor-context-response';
import { recognitionSchemas } from './generated/schemas';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';

it('agrees with Python task identity and preserves every non-anchor field and original input', () => {
  const before = structuredClone(quoteOriginal);
  expect(quoteTaskId(quoteTask)).toBe(quoteTask.task_id);
  expect(anchorQuoteBinding(quoteTask, quoteParent, quoteOriginal)).toEqual(
    quoteTask,
  );
  const result = anchorContextResponse(
    quoteTask,
    JSON.stringify(quoteResponse),
    quoteParent,
    quoteOriginal,
  );
  expect(result.corrected).not.toBeNull();
  const corrected = result.corrected!;
  corrected.segments[0].spans.forEach((span, i) => {
    expect(anchorMatches(corrected.segments[0].text, span.anchor!)).toBe(1);
    span.anchor = before.segments[0].spans[i].anchor;
  });
  expect(corrected).toEqual(before);
  expect(quoteOriginal).toEqual(before);
  expect(() =>
    anchorContextBinding(quoteTask, quoteParent, quoteOriginal),
  ).toThrow();
});
it('uses the same durable parent opportunity with a distinct prompt and canonical response grammar', () => {
  const task = anchorContextProviderTask(
    quoteTask,
    quoteParent,
    quoteOriginal,
    true,
  );
  expect(task.taskId).toBe(
    'anchor-context-parent-' + contextSha(quoteParent.task_id),
  );
  expect(task.promptVersion).toBe('ava-recognition-anchor-quote-2');
  expect(task.responseSchema).toEqual(
    recognitionSchemas.RecognitionAnchorQuoteResponse,
  );
  expect(
    JSON.stringify(providerResponseSchema('google/gemini-3.8-flash', task)),
  ).toContain('allowed_quotations');
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', {
      ...task,
      responseSchema: { type: 'object' },
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it.each([
  'candidate',
  'text',
  'span',
  'source',
  'render',
  'duplicate',
] as const)('rejects a rebound %s task', (field) => {
  const task = structuredClone(quoteTask);
  if (field === 'candidate') task.slots[0].allowed_quotations = ['left¹'];
  if (field === 'text') task.slots[0].segment_text_sha256 = 'f'.repeat(64);
  if (field === 'span') task.slots[0].span_sha256 = 'f'.repeat(64);
  if (field === 'source') task.source_sha256 = 'f'.repeat(64);
  if (field === 'render') task.render_sha256 = 'f'.repeat(64);
  if (field === 'duplicate') task.slots.push(task.slots[0]);
  task.task_id = quoteTaskId(task);
  expect(() => anchorQuoteBinding(task, quoteParent, quoteOriginal)).toThrow();
});
it.each(['left¹', '₁', '①', '１', '1 ¹'])(
  'refuses unlisted quotation %s',
  (text) => {
    const reply = structuredClone(quoteResponse);
    reply.patches[0].exact_text = text;
    expect(() =>
      anchorContextResponse(
        quoteTask,
        JSON.stringify(reply),
        quoteParent,
        quoteOriginal,
      ),
    ).toThrow('INVALID_RESULT');
  },
);
it('requires exact unique adjacent contexts, full coverage and no unknown patch fields', () => {
  const reply = structuredClone(quoteResponse);
  reply.patches[0].before = '';
  reply.patches[0].after = '';
  expect(() =>
    anchorContextResponse(
      quoteTask,
      JSON.stringify(reply),
      quoteParent,
      quoteOriginal,
    ),
  ).toThrow('INVALID_RESULT');
  for (const patches of [
    quoteResponse.patches.slice(1),
    [
      quoteResponse.patches[0],
      quoteResponse.patches[0],
      quoteResponse.patches[0],
    ],
    [
      { ...quoteResponse.patches[0], style: {} },
      ...quoteResponse.patches.slice(1),
    ],
  ])
    expect(() =>
      anchorContextResponse(
        quoteTask,
        JSON.stringify({ ...quoteResponse, patches }),
        quoteParent,
        quoteOriginal,
      ),
    ).toThrow();
});
it('only maps whole digit strings within the specified family', () => {
  const span = structuredClone(quoteOriginal.segments[0].spans[0]);
  for (const [alignment, quote, alias] of [
    ['super', '0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹'],
    ['sub', '₉₈', '98'],
  ] as const) {
    span.style = { id: 'observed', vertical_align: alignment };
    span.anchor = { exact_text: quote };
    expect(allowedQuotations(quote + ' ' + alias, span)).toEqual([
      quote,
      alias,
    ]);
  }
  span.style = { id: 'observed', vertical_align: 'super' };
  for (const quote of ['１', '①', '1¹', '1₂', '1 2', '1.2', 'i', '₁']) {
    span.anchor = { exact_text: quote };
    expect(allowedQuotations('1 12 ¹ ¹²', span)).toEqual([]);
  }
});
