import { buildSentenceCatalog } from './sentence-catalog';
import { chapterFixture } from '../testing/translation.fixture';

describe('sentence catalog', () => {
  it('reuses sentence IDs across layouts and changes them for a new source revision', () => {
    const first = buildSentenceCatalog(chapterFixture, 'file-1', 'en');
    expect(first).toEqual(buildSentenceCatalog(chapterFixture, 'file-1', 'en'));
    expect(first[0].id).not.toBe(
      buildSentenceCatalog(chapterFixture, 'file-2', 'en')[0].id,
    );
    expect(first.map((unit) => unit.text)).toEqual([
      'Hello reader. ',
      'Another sentence.',
    ]);
  });

  it('counts verbatim inline text in UTF-16 and concatenates list items without separators', () => {
    const text = '  Hello 🐈.  Next.';
    const chapter = {
      ...chapterFixture,
      blocks: [
        {
          id: 'list',
          kind: 'list' as const,
          ordered: true,
          text: 'normalized',
          items: [
            {
              id: 'first',
              text: 'normalized',
              inlines: [
                { kind: 'text' as const, text: '  Hello ' },
                { kind: 'image' as const, src: 'glyph', alt: 'ignored' },
                { kind: 'text' as const, text: '🐈.  Next.' },
              ],
            },
            {
              id: 'second',
              text: 'Last.',
              inlines: [{ kind: 'text' as const, text: 'Last.' }],
            },
          ],
        },
      ],
    };
    const units = buildSentenceCatalog(chapter, 'file-1', 'en');
    expect(units.map((unit) => unit.text).join('')).toBe(`${text}Last.`);
    for (const unit of units) {
      expect(`${text}Last.`.slice(unit.startOffset, unit.endOffset)).toBe(
        unit.text,
      );
    }
    expect(units.at(-1)).toMatchObject({
      itemId: 'second',
      startOffset: text.length,
    });
  });

  it('retains illustrations as non-generating units and distinguishes identical passages', () => {
    const chapter = {
      ...chapterFixture,
      blocks: [
        chapterFixture.blocks[0],
        { ...chapterFixture.blocks[0], id: 'p-2' },
        {
          id: 'image',
          kind: 'image' as const,
          src: 'photo',
          alt: 'Photo',
          text: 'Photo',
        },
      ],
    };
    const units = buildSentenceCatalog(chapter, 'file-1', 'en');
    expect(units[0].id).not.toBe(units[2].id);
    expect(units.at(-1)).toMatchObject({
      kind: 'image',
      blockId: 'image',
      text: '',
    });
  });
});
