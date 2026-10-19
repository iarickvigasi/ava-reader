import {
  getNodeChildren,
  orderedXmlParser,
  type OrderedNode,
} from '../xml-utils';
import { normalizeInlineNodes, normalizeInlineSequence } from './inline';
import { validateInlineTextMap } from './mapped-inline-text';

it('preserves literal spaces, newlines and nearest inline language without a lossy map', async () => {
  const [node] = orderedXmlParser.parse(
    '<pre>  A😀B\n<span xml:lang="uk">  слово</span>\n</pre>',
  ) as OrderedNode[];
  const inlines = await normalizeInlineNodes(
    getNodeChildren(node),
    () => Promise.resolve(null),
    { literal: true, language: 'en' },
  );
  expect(
    inlines
      .filter((i) => i.kind === 'text')
      .map((i) => i.text)
      .join(''),
  ).toBe('  A😀B\n  слово\n');
  expect(inlines[1]).toMatchObject({ language: 'uk' });
  expect(inlines.every((i) => !('sourceNormalization' in i))).toBe(true);
});

it('keeps explicit regular, baseline and false caps over inherited emphasis', async () => {
  const [node] = orderedXmlParser.parse(
    '<p><strong><sup><span style="font-weight:normal;font-style:normal;font-variant:normal;vertical-align:baseline">plain</span></sup></strong></p>',
  ) as OrderedNode[];
  const [inline] = await normalizeInlineNodes(
    getNodeChildren(node),
    () => Promise.resolve(null),
    { presentation: { id: 'parent', italic: true, small_caps: true } },
  );
  expect(inline).toMatchObject({
    text: 'plain',
    bold: false,
    fontWeight: 400,
    italic: false,
    script: undefined,
    presentation: {
      bold: false,
      italic: false,
      small_caps: false,
      vertical_align: 'baseline',
    },
  });
});

it('rejects malformed stored source maps and mappings across Unicode boundaries', () => {
  expect(() =>
    normalizeInlineSequence([
      {
        kind: 'text',
        text: 'A',
        sourceNormalization: { sourceText: 'A', boundaryUtf16: [0, 9] },
      },
    ]),
  ).toThrow('normalization map');
  expect(() => validateInlineTextMap('ab', '😀', [0, 1, 2])).toThrow(
    'Unicode character',
  );
});

it('retains valid zero/false XML scalar text without object stringification', async () => {
  expect(
    await normalizeInlineNodes([{ '#text': 0 }, { '#text': false }], () =>
      Promise.resolve(null),
    ),
  ).toEqual([{ kind: 'text', text: '0false' }]);
  await expect(
    normalizeInlineNodes([{ '#text': { invalid: true } }], () =>
      Promise.resolve(null),
    ),
  ).rejects.toThrow('The EPUB text node has an invalid value.');
});
