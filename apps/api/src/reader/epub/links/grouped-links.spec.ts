import { groupedLinks } from './grouped-links.fixture';
import { picturePackage } from '../picture-chapters.fixture';
import { remapEpubLinks } from './remap-epub-links';
import type { ReaderChapter } from '../../reader-types';

it('preserves a deeper source-relative footnote backlink and incoming exact UTF-16 destinations after grouping', async () => {
  const result = await groupedLinks({
    'body.xhtml':
      '<h1>Story</h1><p>A😀B <a id="call" href="notes/deeper/b.xhtml#n2">2</a> follows.</p><p><a href="https://example.invalid/#n2">External</a></p>',
    'notes/a.xhtml':
      '<aside id="n1" epub:type="footnote"><p>First note.</p><a role="doc-backlink" href="../body.xhtml#call">Back one</a></aside>',
    'notes/deeper/b.xhtml':
      '<aside id="n2" epub:type="footnote"><p>Second note.</p><a role="doc-backlink" href="../../body.xhtml#call">Back two</a></aside>',
  });
  expect(result.chapters.map((c) => c.title)).toEqual(['Story', 'Footnotes']);
  const [body, notes] = result.chapters;
  const call = body.blocks[1];
  const note = notes.blocks.find(
    (b) => b.kind === 'note' && b.text === 'Second note.',
  );
  if (!('inlines' in call) || !note || note.kind !== 'note')
    throw Error('Missing note/caller');
  expect(call.text).toBe('A😀B 2 follows.');
  expect(call.inlines.find((i) => i.href)).toMatchObject({
    sourceOffset: 5,
    target: {
      chapterId: notes.chapterId,
      blockId: note.id,
      textOffset: 0,
      note: true,
    },
  });
  expect(note.returns).toEqual([
    {
      label: 'Back two',
      target: { chapterId: body.chapterId, blockId: call.id, textOffset: 5 },
    },
  ]);
  expect(note.id).not.toContain(notes.chapterId);
  const external = body.blocks[2];
  expect('inlines' in external && external.inlines[0]).toMatchObject({
    href: 'https://example.invalid/#n2',
  });
  expect('inlines' in external && external.inlines[0]).not.toHaveProperty(
    'target',
  );
});

it('keeps a moved picture self-link, incoming link and authored TOC pointing at its retained block', async () => {
  const result = await picturePackage(
    [
      '<p><a href="#figure"><img id="figure" src="art.png" alt="Plate"/></a></p>',
      '<h1>Story</h1><p><a href="0.xhtml#figure">Plate</a></p>',
    ],
    true,
  );
  expect(result.chapters).toHaveLength(1);
  const chapter = result.chapters[0];
  const image = chapter.blocks[0];
  const call = chapter.blocks[2];
  const target = {
    chapterId: chapter.chapterId,
    blockId: image.id,
    textOffset: 0,
  };
  expect(image).toMatchObject({ kind: 'image', anchorIds: ['figure'], target });
  expect('inlines' in call && call.inlines[0]).toMatchObject({ target });
  expect(result.toc[0]).toMatchObject({
    chapterId: chapter.chapterId,
    blockId: image.id,
    spineIndex: 0,
  });
  expect(image.id).toBe('chapter-1-0::b1');
  expect(result.manifest).toMatchObject({ totalChapters: 1, totalBlocks: 3 });
});

it('relocates nested list and table destinations without changing source text, typography or offsets', async () => {
  const result = await groupedLinks({
    'title.xhtml':
      '<section epub:type="titlepage"><h1>Title</h1><p><a href="copyright.xhtml#cell">Credit</a> <a href="copyright.xhtml#item">List</a></p></section>',
    'copyright.xhtml':
      '<section epub:type="copyright-page"><ul><li id="item"><a href="#cell">Cell</a><ul><li id="child">Child</li></ul></li></ul><table><tr><td id="cell">A😀B <a id="call" href="#child"><b>Child</b></a></td></tr></table></section>',
    'body.xhtml': '<h1>Story</h1><p>The story.</p>',
    'notes/ref.xhtml':
      '<aside epub:type="footnote"><p>Reference.</p><a role="doc-backlink" href="../copyright.xhtml#call">Return</a></aside>',
  });
  expect(result.chapters.slice(0, 2).map((c) => c.title)).toEqual([
    'Front matter',
    'Story',
  ]);
  const front = result.chapters[0];
  const list = front.blocks.find((b) => b.kind === 'list');
  const table = front.blocks.find((b) => b.kind === 'table');
  const caller = front.blocks[1];
  if (
    !list ||
    list.kind !== 'list' ||
    !table ||
    table.kind !== 'table' ||
    !('inlines' in caller)
  )
    throw Error('Missing nested blocks');
  const child = list.items[0].children?.[0];
  if (!child || child.kind !== 'list') throw Error('Missing nested child');
  const cell = table.cells[0];
  expect(cell.text).toBe('A😀B Child');
  expect(list.items[0].inlines[0]).toMatchObject({
    target: { chapterId: front.chapterId, blockId: cell.id, textOffset: 0 },
  });
  expect(cell.inlines.find((i) => i.href)).toMatchObject({
    bold: true,
    sourceOffset: 5,
    target: {
      chapterId: front.chapterId,
      blockId: child.items[0].id,
      textOffset: 0,
    },
  });
  expect(
    caller.inlines.filter((i) => i.href).map((i) => i.target?.blockId),
  ).toEqual([cell.id, list.items[0].id]);
  expect(
    caller.inlines
      .filter((i) => i.href)
      .every((i) => i.target?.chapterId === front.chapterId),
  ).toBe(true);
  const note = result.chapters[2].blocks[0];
  expect(note).toMatchObject({
    kind: 'note',
    returns: [
      {
        label: 'Return',
        target: { chapterId: front.chapterId, blockId: cell.id, textOffset: 5 },
      },
    ],
  });
});

it.each(['missing', 'ambiguous'] as const)(
  'rejects %s retained-block ownership rather than guessing a chapter',
  (condition) => {
    const chapter = {
      chapterId: 'one',
      href: 'one.xhtml',
      blocks: [
        {
          id: 'body',
          kind: 'paragraph',
          text: 'Link',
          inlines: [
            {
              kind: 'text',
              text: 'Link',
              target: {
                chapterId: 'removed',
                blockId: 'absent',
                textOffset: 0,
              },
            },
          ],
        },
      ],
    } as ReaderChapter;
    const chapters =
      condition === 'ambiguous'
        ? [chapter, { ...chapter, chapterId: 'two' }]
        : [chapter];
    expect(() => remapEpubLinks(chapters)).toThrow(
      condition === 'ambiguous'
        ? 'ambiguous block destination'
        : 'missing block destination',
    );
  },
);
