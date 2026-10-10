import { normalizeBlocksFromNodes } from './blocks';
import { orderedXmlParser } from './xml-utils';

async function noteBlocks(source: string) {
  return normalizeBlocksFromNodes(
    orderedXmlParser.parse(source) as Record<string, unknown>[],
    'fixture-note',
    () => Promise.resolve(null),
  );
}
describe('ordinary EPUB explicit note-body policy', () => {
  it('keeps authored FX note prose separate from its two explicit backlink actions', async () => {
    const blocks = await noteBlocks(
      '<aside id="note-1" epub:type="endnote"><p>A lantern is a portable light in this invented story.</p><a href="chapter-1.xhtml#callout-1a" role="doc-backlink">Return A</a> <a href="chapter-1.xhtml#callout-1b" role="doc-backlink">Return B</a></aside>',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'note',
      noteRole: 'endnote',
      anchorId: 'note-1',
      text: 'A lantern is a portable light in this invented story.',
      pendingReturns: [
        { label: 'Return A', href: 'chapter-1.xhtml#callout-1a' },
        { label: 'Return B', href: 'chapter-1.xhtml#callout-1b' },
      ],
    });
    expect(
      'inlines' in blocks[0] &&
        blocks[0].inlines
          .filter((inline) => inline.kind === 'text')
          .map((inline) => inline.text)
          .join(''),
    ).toBe(blocks[0].text);
  });
  it('preserves separate paragraphs, styled prose and authored body hyperlinks', async () => {
    const blocks = await noteBlocks(
      '<aside id="note" epub:type="footnote"><p xml:lang="uk">Перша <em>думка</em>.</p><p id="second">Second <a href="https://example.org/body">body reference</a>.</p><a id="back" epub:type="backlink" href="chapter.xhtml#origin"><span id="return-label" name="return-name">Go back</span></a></aside>',
    );
    const note = blocks[0];
    expect(note).toMatchObject({
      kind: 'note',
      noteRole: 'footnote',
      text: 'Перша думка.\nSecond body reference.',
      pendingReturns: [{ label: 'Go back', href: 'chapter.xhtml#origin' }],
      sourceAnchors: ['back', 'return-label', 'return-name'].map((id) => ({
        id,
        textOffset: 'Перша думка.\nSecond body reference.'.length,
      })),
    });
    if (!('inlines' in note)) throw new Error('Missing note');
    expect(
      note.inlines.find(
        (inline) => inline.kind === 'text' && inline.text === 'думка',
      ),
    ).toMatchObject({ language: 'uk', italic: true });
    expect(
      note.inlines.find(
        (inline) => inline.kind === 'text' && inline.text === 'body reference',
      ),
    ).toMatchObject({ href: 'https://example.org/body' });
    expect(
      note.inlines.some((inline) => inline.anchorIds?.includes('second')),
    ).toBe(true);
  });
  it('keeps a normal hyperlink called Return in note prose', async () => {
    const blocks = await noteBlocks(
      '<aside epub:type="endnote"><p>See <a href="https://example.org/return">Return</a> for details.</p></aside>',
    );
    expect(blocks[0]).toMatchObject({
      text: 'See Return for details.',
      pendingReturns: [],
    });
  });
});
