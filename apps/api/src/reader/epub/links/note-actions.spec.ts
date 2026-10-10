import { importedReferences } from './epub-links-fixture';

it('stores authored note prose independently from two resolved return actions', async () => {
  const note =
    '<aside id="note" epub:type="endnote"><p>The note.</p><a id="back" role="doc-backlink" href="../body.xhtml#call">Return A</a> <a epub:type="backlink" href="../body.xhtml#second">Return B</a></aside>';
  const body =
    '<p>A😀B <a id="call" href="notes/end.xhtml#note">1</a> follows.</p><p><a id="second" href="notes/end.xhtml#back">Second</a></p>';
  const { chapters } = await importedReferences(note, body);
  const stored = chapters[2].blocks[1];
  const first = chapters[0].blocks[1];
  const second = chapters[0].blocks[2];
  expect(stored).toMatchObject({
    kind: 'note',
    noteRole: 'endnote',
    text: 'The note.',
    returns: [
      { label: 'Return A', target: { blockId: first.id, textOffset: 5 } },
      { label: 'Return B', target: { blockId: second.id, textOffset: 0 } },
    ],
  });
  expect(stored).not.toHaveProperty('pendingReturns');
  expect('inlines' in second && second.inlines[0]).toMatchObject({
    target: { blockId: stored.id, textOffset: 9, note: true },
  });
});

it.each([
  ['epub:type="footnote"', 'footnote'],
  ['epub:type="endnote"', 'endnote'],
  ['role="doc-footnote"', 'footnote'],
  ['role="doc-endnote"', 'endnote'],
] as const)(
  'keeps semantic %s note targets and aliases',
  async (attributes, noteRole) => {
    const { chapters } = await importedReferences(
      `<aside id="note" ${attributes}><p><span id="inside">The note.</span></p><a role="doc-backlink" href="../body.xhtml#call"><span id="back">Back</span></a></aside>`,
      '<p><a id="call" href="notes/end.xhtml#note">1</a> <a href="notes/end.xhtml#inside">2</a> <a href="notes/end.xhtml#back">3</a></p>',
    );
    const note = chapters[2].blocks[1];
    const body = chapters[0].blocks[1];
    expect(note).toMatchObject({ kind: 'note', noteRole, text: 'The note.' });
    if (!('inlines' in body)) throw Error('Expected call paragraph');
    expect(
      body.inlines
        .filter((inline) => inline.href)
        .map((inline) => inline.target),
    ).toEqual([
      {
        chapterId: chapters[2].chapterId,
        blockId: note.id,
        textOffset: 0,
        note: true,
      },
      {
        chapterId: chapters[2].chapterId,
        blockId: note.id,
        textOffset: 0,
        note: true,
      },
      {
        chapterId: chapters[2].chapterId,
        blockId: note.id,
        textOffset: 9,
        note: true,
      },
    ]);
  },
);
