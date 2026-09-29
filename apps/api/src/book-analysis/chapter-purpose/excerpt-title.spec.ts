import { normalizeChapterTitle, UNTITLED } from './normalize-title';

it.each(['3. Opening words…', '3.', 'Chapter 3'])(
  'excludes generated title %s from analysis',
  (title) => {
    expect(normalizeChapterTitle({ title, label: title, spineIndex: 2 })).toBe(
      UNTITLED,
    );
  },
);

it('preserves authored numbered titles', () => {
  expect(
    normalizeChapterTitle({
      title: '3. Homecoming',
      label: null,
      spineIndex: 2,
    }),
  ).toBe('3. Homecoming');
});
