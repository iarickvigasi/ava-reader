import { importedReferences } from './epub-links-fixture';

it('binds note returns to normalized stored text and retains the whitespace map', async () => {
  const { chapters } = await importedReferences(
    undefined,
    '<p>  A <b>B</b> <a id="call" href="notes/end.xhtml#note">1</a>.</p>',
  );
  const body = chapters[0].blocks[1];
  const note = chapters[2].blocks[1];
  if (!('inlines' in body) || !('inlines' in note))
    throw Error('Expected text');
  expect(body.text).toBe('A B 1.');
  expect(body.inlines[0]).toMatchObject({
    sourceNormalization: { sourceText: '  A ', boundaryUtf16: [0, 0, 0, 1, 2] },
  });
  expect(body.inlines.find((i) => i.href)).toMatchObject({ sourceOffset: 4 });
  expect(note.inlines.find((i) => i.href)).toMatchObject({
    target: { blockId: body.id, textOffset: 4 },
  });
});

it.each([
  ['<ol><li id="note">The note.</li></ol>', '::li1', 0],
  ['<div id="note"><p id="paragraph">The note.</p></div>', '::b2', 0],
  ['<a id="note"/><p>The note.</p>', '::b2', 0],
  ['<p>The note.</p><a id="note"/>', '::b2', 9],
] as const)('retains source aliases in %s', async (note, suffix, offset) => {
  const { chapters } = await importedReferences(
    note,
    '<p><a href="notes/end.xhtml#note">Call</a></p>',
  );
  const body = chapters[0].blocks[1];
  if (!('inlines' in body)) throw Error('Expected call');
  expect(body.inlines[0]).toMatchObject({
    target: { chapterId: chapters[2].chapterId, textOffset: offset },
  });
  expect(body.inlines[0].target?.blockId.endsWith(suffix)).toBe(true);
});

it('keeps a promoted image destination and resolves its own internal link', async () => {
  const { chapters } = await importedReferences(
    '<p id="note"><a href="../body.xhtml#figure">Figure</a></p>',
    '<p>First <a href="notes/end.xhtml#note"><img id="figure" src="large.png" alt="Figure"/></a> after</p>',
  );
  const image = chapters[0].blocks.find((b) => b.kind === 'image');
  const note = chapters[2].blocks[1];
  if (!image || image.kind !== 'image' || !('inlines' in note))
    throw Error('Expected figure/note');
  expect(image).toMatchObject({
    width: 300,
    height: 20,
    anchorIds: ['figure'],
    sourceOffset: 0,
    target: { blockId: note.id, textOffset: 0 },
  });
  expect(note.inlines[0]).toMatchObject({
    target: { blockId: image.id, textOffset: 0 },
  });
});
