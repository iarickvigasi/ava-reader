import { fixture } from './package.fixture';
import { relabelPackage } from './relabel-package';

it.each(['Chapter 1', '1. It was a bright cold day…'])(
  'upgrades %s using opening headings without changing content',
  (label) => {
    const original = fixture();
    original.chapters[0].label = original.toc[0].label = label;
    original.chapters[0].blocks.unshift(
      { kind: 'heading', id: 'number', level: 2, text: '1', inlines: [] },
      {
        kind: 'heading',
        id: 'title',
        level: 2,
        text: 'Wanted: Men Who Love',
        inlines: [],
      },
    );
    original.toc[0].children = [
      {
        ...original.toc[0],
        id: 'section',
        label: 'Authored section',
        children: [],
      },
    ];
    const { readerPackage, changes } = relabelPackage(original);
    expect(changes).toContainEqual({
      chapterId: 'c0',
      before: label,
      after: 'Wanted: Men Who Love',
    });
    expect(readerPackage.chapters[0]).toEqual({
      ...original.chapters[0],
      label: 'Wanted: Men Who Love',
      title: 'Wanted: Men Who Love',
    });
    expect(readerPackage.chapters[0].blocks).toBe(original.chapters[0].blocks);
    expect(readerPackage.toc[0].label).toBe('Wanted: Men Who Love');
    expect(readerPackage.toc[0].children[0].label).toBe('Authored section');
    expect(relabelPackage(readerPackage).changes).toEqual([]);
  },
);

it('repairs a heading-only number fallback and preserves authored ellipses', () => {
  const original = fixture();
  original.chapters[1].label = '2.';
  original.chapters[1].blocks = [
    { kind: 'heading', id: 'h', level: 2, text: 'Preface', inlines: [] },
  ];
  original.chapters[0].label = '1. An authored title…';
  const { readerPackage, changes } = relabelPackage(original);
  expect(readerPackage.chapters[1].label).toBe('Preface');
  expect(readerPackage.chapters[0]).toBe(original.chapters[0]);
  expect(changes).toHaveLength(1);
});

it('keeps excerpts when the only heading repeats the book title or follows prose', () => {
  const original = fixture();
  original.chapters[0].label = '1. It was a bright cold day…';
  const heading = {
    kind: 'heading' as const,
    id: 'h',
    level: 2,
    text: 'Book',
    inlines: [],
  };
  original.chapters[0].blocks.unshift(heading);
  expect(relabelPackage(original).readerPackage.chapters[0]).toBe(
    original.chapters[0],
  );
  original.chapters[0].blocks.shift();
  original.chapters[0].blocks.push({ ...heading, text: 'Later section' });
  expect(relabelPackage(original).readerPackage.chapters[0]).toBe(
    original.chapters[0],
  );
});
