import { xmlParser } from '../xml-utils';
import { readNcxEntries } from './ncx-parser';
import { enrichOpeningLabel } from '../enrich-opening-label';

it('preserves numeric NCX labels instead of substituting filenames', () => {
  const xml =
    '<navMap><navPoint><navLabel><text>Part One</text></navLabel><content src="part.html"/><navPoint><navLabel><text>1</text></navLabel><content src="006-chapter01.html"/></navPoint></navPoint></navMap>';
  const parsed = xmlParser.parse(xml) as {
    navMap: { navPoint: Parameters<typeof readNcxEntries>[0][number] };
  };
  const toc = readNcxEntries([parsed.navMap.navPoint]);
  expect(toc[0].children[0].label).toBe('1');
  expect(
    enrichOpeningLabel(
      toc[0].children[0].label,
      'Chapter One / DISCOVERING SELF-COMPASSION',
    ),
  ).toBe('Chapter One / DISCOVERING SELF-COMPASSION');
});

it('keeps zero and leaves authored nonnumeric names intact', () => {
  expect(
    readNcxEntries([
      { navLabel: { text: 0 }, content: { '@_src': 'zero.html' } },
    ])[0].label,
  ).toBe('0');
  expect(enrichOpeningLabel('An authored title', 'Chapter One / Opening')).toBe(
    'An authored title',
  );
});
