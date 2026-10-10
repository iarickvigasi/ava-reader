import { createHash } from 'crypto';
import { importSourceFindingFixture } from './source-finding-fixture';
import { EpubSourceFindingError } from './source-finding';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
describe('ordinary EPUB list source findings', () => {
  it('refuses accepted reordered prose and identifies the exact source item without prose', async () => {
    const id = 'private prose must not enter diagnostics';
    try {
      await importSourceFindingFixture(
        `<ol id="parent-list"><li id="${id}">Before<ul><li>Nested</li></ul><em>After</em></li></ol>`,
      );
      throw new Error('Expected unsupported mixed list flow to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(EpubSourceFindingError);
      if (!(error instanceof EpubSourceFindingError)) throw error;
      expect(error.message).toBe(
        'This EPUB contains a structure AVA cannot preserve.',
      );
      expect(error.finding).toEqual({
        schema: 'ava.epub-source-finding.v1',
        code: 'EPUB_UNSUPPORTED_LIST_FLOW',
        source: {
          resourcePath: 'OEBPS/text/body.xhtml',
          elementTag: 'li',
          siblingIndex: 0,
          treePath: [0, 1, 0],
          elementIdSha256: hash(id),
          parentIdSha256: hash('parent-list'),
        },
      });
      expect(JSON.stringify(error.finding)).not.toContain(id);
      expect(JSON.stringify(error.finding)).not.toContain('After');
    }
  });
  it('refuses a nested list hidden in an inline projection wrapper', async () => {
    await expect(
      importSourceFindingFixture(
        '<ul><li id="wrapped">Before<div><ol><li>Nested</li></ol></div></li></ul>',
      ),
    ).rejects.toMatchObject({
      finding: {
        code: 'EPUB_UNSUPPORTED_LIST_FLOW',
        source: { elementIdSha256: hash('wrapped') },
      },
    });
  });
  it.each([
    '<p>First paragraph.</p><p>Second paragraph.</p>',
    '<div>First line.</div><div>Second line.</div>',
    '<pre>line 1\n    line 2</pre>',
    '<span><blockquote>Quoted paragraph.</blockquote></span>',
  ])(
    'refuses structured own list flow instead of flattening %s',
    async (flow) => {
      await expect(
        importSourceFindingFixture(`<ul><li id="item">${flow}</li></ul>`),
      ).rejects.toMatchObject({
        finding: {
          code: 'EPUB_UNSUPPORTED_LIST_FLOW',
          source: {
            resourcePath: 'OEBPS/text/body.xhtml',
            elementTag: 'li',
            treePath: [0, 1, 0],
            elementIdSha256: hash('item'),
          },
        },
      });
    },
  );
  it('preserves supported leading prose, direct nested lists and trailing formatting whitespace', async () => {
    const book = await importSourceFindingFixture(
      '<ol start="3"><li>Before<ul><li>Nested</li></ul> \n </li><li>Next</li></ol>',
    );
    const list = book.chapters[0].blocks.find((block) => block.kind === 'list');
    expect(list).toMatchObject({
      start: 3,
      text: 'Before\nNested\nNext',
      items: [
        { text: 'Before', children: [{ items: [{ text: 'Nested' }] }] },
        { text: 'Next' },
      ],
    });
  });
});
