import { parseRecord } from './parse-record';
import { normalizeIsbn } from './normalize-isbn';
import { normalizeLanguage } from './normalize-language';
import { references } from './raw-fields';

const payload = {
  key: '/works/OL1W',
  type: { key: '/type/work' },
  title: 'Пример',
};
const line = (data: unknown = payload) =>
  [
    '/type/work',
    '/works/OL1W',
    '12',
    '2026-10-23T00:00:00.000000',
    JSON.stringify(data),
  ].join('\t');

describe('Open Library normalization', () => {
  it('parses the dump envelope without losing Unicode or source revision', () => {
    expect(parseRecord(line())).toMatchObject({
      kind: 'WORK',
      revision: 12,
      externalId: '/works/OL1W',
      payload: { title: 'Пример' },
    });
  });
  it.each([
    null,
    'bad',
    line({ ...payload, key: '/works/OL2W' }),
    line({ ...payload, title: '' }),
    line().replace('\t12\t', '\t-1\t'),
    line().replace('2026-10-23', 'invalid'),
  ])('rejects malformed or contradictory records', (input) =>
    expect(() => parseRecord(input)).toThrow(),
  );
  it('normalizes checked ISBN-10 and ISBN-13 to one edition identifier', () => {
    expect(normalizeIsbn('0-14-032872-6')).toBe('9780140328721');
    expect(normalizeIsbn('9780140328721')).toBe('9780140328721');
    expect(normalizeIsbn('9780140328722')).toBeUndefined();
    expect(normalizeIsbn('0140328727')).toBeUndefined();
  });
  it('maps known languages and retains valid less common language codes', () => {
    expect(normalizeLanguage({ key: '/languages/eng' })).toBe('en');
    expect(normalizeLanguage({ key: '/languages/isl' })).toBe('isl');
    expect(normalizeLanguage({ key: 'garbage' })).toBeUndefined();
  });
  it('extracts direct/nested author links and refuses ambiguous malformed references', () => {
    expect(
      references([{ author: { key: '/authors/OL1A' } }], 'authors'),
    ).toEqual(['/authors/OL1A']);
    expect(() => references([{ name: 'A writer' }], 'authors')).toThrow();
  });
});
