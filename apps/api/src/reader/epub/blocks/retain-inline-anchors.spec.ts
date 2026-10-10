import {
  getNodeChildren,
  orderedXmlParser,
  type OrderedNode,
} from '../xml-utils';
import { buildInlineText, normalizeInlineNodes } from './inline';

it('retains nested and empty inline anchors without adding or losing characters', async () => {
  const nodes = orderedXmlParser.parse(
    '<p>A😀B <span id="outer"><b id="inner">bold</b> plain</span><a id="end"/></p>',
  ) as OrderedNode[];
  const inlines = await normalizeInlineNodes(getNodeChildren(nodes[0]), () =>
    Promise.resolve(null),
  );
  expect(buildInlineText(inlines)).toBe('A😀B bold plain');
  expect(inlines).toContainEqual(
    expect.objectContaining({
      text: 'bold',
      anchorIds: ['outer', 'inner'],
      bold: true,
    }),
  );
  expect(inlines.at(-1)).toMatchObject({ text: '', anchorIds: ['end'] });
});

it('keeps the exact inline UTF-16 anchor position across style runs', async () => {
  const nodes = orderedXmlParser.parse(
    '<p>A😀B <span id="call">1</span> follows.</p>',
  ) as OrderedNode[];
  const inlines = await normalizeInlineNodes(getNodeChildren(nodes[0]), () =>
    Promise.resolve(null),
  );
  const at = inlines.findIndex(
    (i) => i.kind === 'text' && i.anchorIds?.includes('call'),
  );
  expect(at).toBeGreaterThanOrEqual(0);
  expect(
    inlines
      .slice(0, at)
      .filter((i) => i.kind === 'text')
      .map((i) => i.text)
      .join('').length,
  ).toBe(5);
  expect(inlines[at]).toMatchObject({ anchorIds: ['call'] });
  expect(inlines[at].kind === 'text' && inlines[at].text.startsWith('1')).toBe(
    true,
  );
  expect(
    inlines
      .filter((i) => i.kind === 'text')
      .map((i) => i.text)
      .join(''),
  ).toBe('A😀B 1 follows.');
});
