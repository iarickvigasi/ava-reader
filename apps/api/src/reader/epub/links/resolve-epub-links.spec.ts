import { importedReferences } from './epub-links-fixture';

it('resolves a distant note and its exact inline UTF-16 return without changing text', async () => {
  const { chapters } = await importedReferences();
  const body = chapters[0].blocks[1];
  const note = chapters[2].blocks[1];
  if (!('inlines' in body) || !('inlines' in note))
    throw new Error('Missing test text');
  const call = body.inlines.find(
    (i) => i.kind === 'text' && i.href?.includes('#note'),
  );
  const back = note.inlines.find(
    (i) => i.kind === 'text' && i.href?.includes('#call'),
  );
  expect(call).toMatchObject({
    text: '1',
    sourceOffset: 5,
    target: {
      chapterId: chapters[2].chapterId,
      blockId: note.id,
      textOffset: 0,
    },
  });
  expect(back).toMatchObject({
    target: {
      chapterId: chapters[0].chapterId,
      blockId: body.id,
      textOffset: 5,
    },
  });
  expect(body.text).toBe('A😀B 1 follows.');
  expect(
    body.inlines
      .filter((i) => i.kind === 'text')
      .map((i) => i.text)
      .join(''),
  ).toBe(body.text);
  const external = chapters[0].blocks[2];
  expect('inlines' in external && external.inlines[0]).toMatchObject({
    href: 'https://example.invalid/#note',
  });
  expect('inlines' in external && external.inlines[0]).not.toHaveProperty(
    'target',
  );
});

it('does not confuse a repeated anchor name in distinct source resources', async () => {
  const { chapters } = await importedReferences(
    '<p id="note"><a href="../middle.xhtml#same">Second</a><a href="../body.xhtml#same">First</a></p>',
  );
  const note = chapters[2].blocks[1];
  if (!('inlines' in note)) throw new Error('Missing note');
  expect(note.inlines[0]).toMatchObject({
    target: {
      chapterId: chapters[1].chapterId,
      blockId: chapters[1].blocks[1].id,
    },
  });
  expect(note.inlines[1]).toMatchObject({
    target: {
      chapterId: chapters[0].chapterId,
      blockId: chapters[0].blocks[1].id,
    },
  });
});

it('rejects an absent required inline return anchor rather than sending it to the browser', async () => {
  await expect(
    importedReferences(
      '<p id="note"><a href="../body.xhtml#absent">Return</a></p>',
    ),
  ).rejects.toThrow('missing or ambiguous internal reference');
});

it('rejects ambiguous note anchors within one resource', async () => {
  await expect(
    importedReferences('<p id="note">First.</p><p id="note">Second.</p>'),
  ).rejects.toThrow('missing or ambiguous internal reference');
});
