import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';
import { build, text } from './opening-labels.fixture';
import { fixture } from '../../scripts/chapter-label-backfill/package.fixture';
import { relabelPackage } from '../../scripts/chapter-label-backfill/relabel-package';

const publisher = 'Constable & Robinson Ltd';
const copyright = [
  publisher,
  '55–56 Russell Square',
  'London WC1B 4HP',
  'www.constablerobinson.com',
  'First published in the UK by Constable,',
  'All rights reserved. '.repeat(20),
].map((value) => ({ ...text(value), level: 6 }));

it('rejects the entire oversized semantic heading group on a publisher page', () => {
  expect(getChapterTitleFromBlocks(copyright)).toBe(publisher);
  expect(build([copyright])[0].label).toBe(publisher);
  const original = fixture();
  original.chapters[0].blocks = copyright;
  original.chapters[0].label =
    original.chapters[0].title =
    original.toc[0].label =
      publisher;
  const result = relabelPackage(original);
  expect(result.changes.some((change) => change.chapterId === 'c0')).toBe(
    false,
  );
  expect(result.readerPackage.chapters[0]).toBe(original.chapters[0]);
  expect(result.readerPackage.toc[0].label).toBe(publisher);
});

it('rejects an overlong group even when it contains only two headings', () => {
  expect(
    getChapterTitleFromBlocks([
      text(publisher),
      text('Legal notice. '.repeat(30)),
    ]),
  ).toBe(publisher);
});

it('retains a single authored long title without truncation', () => {
  const title = 'A very long authored heading '.repeat(10);
  expect(getChapterTitleFromBlocks([text(title)])).toBe(title.trim());
});

it('keeps three-part titles and ignores duplicate headings when counting', () => {
  const headings = ['CHAPTER TWO', 'NATURAL HISTORY', 'Bemushroomed'];
  expect(
    getChapterTitleFromBlocks(
      [...headings, 'Bemushroomed'].map((value) => text(value)),
    ),
  ).toBe(headings.join(' / '));
});
