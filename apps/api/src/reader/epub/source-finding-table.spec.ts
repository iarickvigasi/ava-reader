import { createHash } from 'crypto';
import { importSourceFindingFixture } from './source-finding-fixture';
import { EpubSourceFindingError } from './source-finding';

describe('ordinary EPUB table source findings', () => {
  it.each([
    '<ol><li>Nested list</li></ol>',
    '<table><tr><td>Nested table</td></tr></table>',
    '<p>First paragraph</p><p>Second paragraph</p>',
    '<pre>literal\n    code</pre>',
  ])('refuses nested structured cell content: %s', async (structure) => {
    try {
      await importSourceFindingFixture(
        `<table id="register"><tbody><tr><td id="cell">${structure}</td></tr></tbody></table>`,
      );
      throw new Error('Expected unsupported structured table cell to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(EpubSourceFindingError);
      if (!(error instanceof EpubSourceFindingError)) throw error;
      expect(error.finding).toEqual({
        schema: 'ava.epub-source-finding.v1',
        code: 'EPUB_UNSUPPORTED_TABLE_CELL',
        source: {
          resourcePath: 'OEBPS/text/body.xhtml',
          elementTag: 'td',
          siblingIndex: 0,
          treePath: [0, 1, 0, 0, 0],
          elementIdSha256: createHash('sha256').update('cell').digest('hex'),
          parentIdSha256: createHash('sha256').update('register').digest('hex'),
        },
      });
      expect(JSON.stringify(error.finding)).not.toContain(structure);
    }
  });
  it('keeps simple inline table cells, axes, markup and literal line breaks', async () => {
    const book = await importSourceFindingFixture(
      '<table><tr><th scope="row">Place</th><td><em>Harbour</em><br/>4</td></tr></table>',
    );
    const table = book.chapters[0].blocks.find(
      (block) => block.kind === 'table',
    );
    expect(table).toMatchObject({
      cells: [
        { row: 0, column: 0, text: 'Place', headerAxis: 'row' },
        { row: 0, column: 1, text: 'Harbour\n4', headerAxis: null },
      ],
    });
    if (table?.kind !== 'table') throw new Error('Expected simple table');
    expect(table.cells[1].inlines[0]).toMatchObject({
      text: 'Harbour',
      italic: true,
    });
  });
});
