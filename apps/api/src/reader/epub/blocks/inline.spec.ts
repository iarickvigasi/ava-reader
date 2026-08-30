import { getNodeChildren, orderedXmlParser, OrderedNode } from '../xml-utils';
import { buildInlineText, normalizeInlineNodes } from './inline';

// Drives a real XHTML fragment through the EPUB parser so these assertions
// cover what publishers actually ship, not a hand-built node shape.
function inlinesOf(paragraphMarkup: string) {
  const nodes = orderedXmlParser.parse(paragraphMarkup) as OrderedNode[];
  return normalizeInlineNodes(getNodeChildren(nodes[0]), () =>
    Promise.resolve(null),
  );
}

describe('normalizeInlineNodes vertical script', () => {
  it('keeps an exponent as its own superscript run', async () => {
    const inlines = await inlinesOf('<p>10<sup>500</sup></p>');

    expect(inlines).toHaveLength(2);
    expect(inlines[0]).toMatchObject({ script: undefined, text: '10' });
    expect(inlines[1]).toMatchObject({ script: 'super', text: '500' });
  });

  it('keeps a negative exponent whole', async () => {
    const inlines = await inlinesOf('<p>10<sup>-30</sup></p>');

    expect(inlines[1]).toMatchObject({ script: 'super', text: '-30' });
  });

  it('marks a subscript run', async () => {
    const inlines = await inlinesOf('<p>H<sub>2</sub>O</p>');

    expect(
      inlines.map((inline) => inline.kind === 'text' && inline.script),
    ).toEqual([undefined, 'sub', undefined]);
  });

  it('leaves ordinary text without a script', async () => {
    const inlines = await inlinesOf('<p>10 to the power of 500</p>');

    expect(inlines).toHaveLength(1);
    expect(inlines[0]).toMatchObject({ script: undefined });
  });

  it('keeps the link on a superscript footnote marker', async () => {
    const inlines = await inlinesOf(
      '<p>Fact<sup><a href="#fn1">1</a></sup></p>',
    );

    expect(inlines[1]).toMatchObject({
      href: '#fn1',
      script: 'super',
      text: '1',
    });
  });

  it('keeps bold inside a superscript', async () => {
    const inlines = await inlinesOf('<p>10<sup><strong>500</strong></sup></p>');

    expect(inlines[1]).toMatchObject({ bold: true, script: 'super' });
  });

  it('resolves nesting to the nearest ancestor', async () => {
    const inlines = await inlinesOf('<p>x<sup><sub>i</sub></sup></p>');

    expect(inlines[1]).toMatchObject({ script: 'sub', text: 'i' });
  });

  it('adds no characters to the block text', async () => {
    const inlines = await inlinesOf('<p>10<sup>500</sup> grains</p>');

    expect(buildInlineText(inlines)).toBe('10500 grains');
  });
});
