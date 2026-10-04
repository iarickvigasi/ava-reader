import { importSourceFindingFixture } from './source-finding-fixture';
import { normalizeInlineSequence } from './blocks/inline';
import { validateInlineTextMap } from './blocks/mapped-inline-text';

it('stores maps for every removed boundary-space run in a real ordinary import', async () => {
  const book = await importSourceFindingFixture(
    '<p> <em>A😀B</em>  <strong>word</strong> </p>',
  );
  const body = book.chapters[0].blocks[1];
  if (!('inlines' in body)) throw Error('Expected source paragraph.');
  const texts = body.inlines.filter((inline) => inline.kind === 'text');
  expect(body.text).toBe('A😀B word');
  expect(
    texts
      .map((inline) => inline.sourceNormalization?.sourceText ?? inline.text)
      .join(''),
  ).toBe(' A😀B  word ');
  expect(texts[0]).toMatchObject({
    text: '',
    sourceNormalization: { sourceText: ' ', boundaryUtf16: [0, 0] },
  });
  expect(texts.at(-1)).toMatchObject({
    text: '',
    sourceNormalization: { sourceText: ' ', boundaryUtf16: [0, 0] },
  });
  for (const inline of texts)
    if (inline.sourceNormalization)
      validateInlineTextMap(
        inline.sourceNormalization.sourceText,
        inline.text,
        inline.sourceNormalization.boundaryUtf16,
      );
  expect(normalizeInlineSequence(body.inlines)).toEqual(body.inlines);
});
it('retains fully removed styled runs without altering accepted readable text', () => {
  expect(
    normalizeInlineSequence([
      { kind: 'text', text: '  ', italic: true },
      { kind: 'text', text: 'A😀B', bold: true },
      { kind: 'text', text: '\n ', language: 'uk' },
    ]),
  ).toEqual([
    {
      kind: 'text',
      text: '',
      italic: true,
      sourceNormalization: { sourceText: '  ', boundaryUtf16: [0, 0, 0] },
    },
    { kind: 'text', text: 'A😀B', bold: true },
    {
      kind: 'text',
      text: '',
      language: 'uk',
      sourceNormalization: { sourceText: '\n ', boundaryUtf16: [0, 0, 0] },
    },
  ]);
});
