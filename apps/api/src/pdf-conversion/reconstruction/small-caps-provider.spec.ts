import {
  capsParent,
  capsOriginal,
  capsTask,
  capsResponse,
} from './small-caps-fixture';
import { anchorQuoteBinding, anchorMatches } from './anchor-context-binding';
import { anchorContextResponse } from './anchor-context-response';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { quoteTaskId, allowedQuotations } from './anchor-quote-candidates';
import { smallCapsQuotations } from './small-caps-quote-candidates';
import { recognitionSchemas } from './generated/schemas';
import { validatePacket } from './validate-packet';

it('binds Python Task3 and changes only the requested anchor', () => {
  const before = structuredClone(capsOriginal);
  expect(quoteTaskId(capsTask)).toBe(capsTask.task_id);
  expect(anchorQuoteBinding(capsTask, capsParent, capsOriginal)).toEqual(
    capsTask,
  );
  expect(() =>
    validatePacket('RecognitionAnchorQuoteTask', capsTask),
  ).toThrow();
  const result = anchorContextResponse(
    capsTask,
    JSON.stringify(capsResponse),
    capsParent,
    capsOriginal,
  ).corrected!;
  expect(
    anchorMatches(result.segments[0].text, result.segments[0].spans[0].anchor!),
  ).toBe(1);
  result.segments[0].spans[0].anchor = before.segments[0].spans[0].anchor;
  expect(result).toEqual(before);
  expect(capsOriginal).toEqual(before);
  const provider = anchorContextProviderTask(
    capsTask,
    capsParent,
    capsOriginal,
    true,
  );
  expect(provider.promptVersion).toBe('ava-recognition-anchor-quote-3');
  expect(provider.responseSchema).toEqual(
    recognitionSchemas.RecognitionAnchorQuoteResponse,
  );
});
it('rejects selecting inner BC even when another whole-token BC is offered', () => {
  const response = structuredClone(capsResponse);
  response.patches[0].before = 'and A';
  response.patches[0].after = 'D.';
  expect(() =>
    anchorContextResponse(
      capsTask,
      JSON.stringify(response),
      capsParent,
      capsOriginal,
    ),
  ).toThrow('INVALID_RESULT');
});
it('preserves historical candidates and rejects Unicode lookalikes and partial tokens', () => {
  const span = capsOriginal.segments[0].spans[0];
  expect(allowedQuotations('BC', span)).toEqual([]);
  expect(smallCapsQuotations('BC', span)).toEqual(['BC']);
  for (const text of ['ABCD', 'BCé', 'BC_', 'BĆ', 'BC\u200d', 'іBC', 'BC2'])
    expect(smallCapsQuotations(text, span)).toEqual([]);
  expect(smallCapsQuotations('bc then BC', span)).toEqual(['bc']);
  for (const [quote, text] of [
    ['ß', 'SS'],
    ['ı', 'I'],
    ['bс', 'BC'],
    ['Bc', 'BC'],
  ])
    expect(
      smallCapsQuotations(text, { ...span, anchor: { exact_text: quote } }),
    ).toEqual([]);
});
