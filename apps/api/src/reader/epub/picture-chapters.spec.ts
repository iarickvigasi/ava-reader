import { picturePackage, picture, prose } from './picture-chapters.fixture';

it('merges consecutive pictures forward across empty documents without losing blocks or IDs', async () => {
  const result = await picturePackage([
    picture,
    '<p> &#160; <br/></p>',
    picture,
    prose,
  ]);
  expect(result.chapters).toHaveLength(1);
  const chapter = result.chapters[0];
  expect(chapter).toMatchObject({
    chapterId: 'chapter-3-3',
    title: 'Story',
    spineIndex: 0,
    previousChapterId: null,
    nextChapterId: null,
  });
  expect(chapter.blocks.map((block) => block.kind)).toEqual([
    'image',
    'image',
    'heading',
    'paragraph',
  ]);
  expect(chapter.blocks.map((block) => block.id)).toEqual([
    'chapter-1-0::b1',
    'chapter-2-2::b1',
    'chapter-3-3::b1',
    'chapter-3-3::b2',
  ]);
  expect(result.manifest).toMatchObject({ totalChapters: 1, totalBlocks: 4 });
  expect(result.toc).toHaveLength(1);
});

it('preserves authored TOC destinations for pictures and the following text', async () => {
  const result = await picturePackage([picture, prose], true);
  expect(result.chapters).toHaveLength(1);
  expect(
    result.toc.map((node) => [node.chapterId, node.blockId, node.spineIndex]),
  ).toEqual([
    ['chapter-2-1', 'chapter-1-0::b1', 0],
    ['chapter-2-1', 'chapter-2-1::b1', 0],
  ]);
});

it('retains trailing pictures and repairs navigation in both directions', async () => {
  const result = await picturePackage([prose, picture, prose, picture]);
  expect(result.chapters.map((chapter) => chapter.blocks.length)).toEqual([
    2, 3, 1,
  ]);
  for (const [i, chapter] of result.chapters.entries()) {
    expect(chapter.previousChapterId).toBe(
      result.chapters[i - 1]?.chapterId ?? null,
    );
    expect(chapter.nextChapterId).toBe(
      result.chapters[i + 1]?.chapterId ?? null,
    );
    expect(chapter.spineIndex).toBe(i);
  }
});

it('keeps an entirely illustrated book readable', async () => {
  expect((await picturePackage([picture, picture])).chapters).toHaveLength(2);
});

it('drops blank sections but preserves headings and mixed picture/text chapters', async () => {
  const result = await picturePackage([
    '<p> </p>',
    '<h1>Part One</h1>',
    picture + prose,
    '<div><br/></div>',
  ]);
  expect(result.chapters).toHaveLength(2);
  expect(result.chapters.map((chapter) => chapter.blocks.length)).toEqual([
    1, 3,
  ]);
});
