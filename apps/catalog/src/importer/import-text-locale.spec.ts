import { importTextLocale } from './import-text-locale';
it('retains regional locale distinctions and normalizes legacy language codes', () => {
  expect(importTextLocale('en-GB')).toBe('en-GB');
  expect(importTextLocale('ukr')).toBe('uk');
});
it('rejects unspecified or malformed translation locales instead of mislabeling them', () => {
  expect(() => importTextLocale(undefined)).toThrow('locale');
  expect(() => importTextLocale('wrong locale')).toThrow('locale');
});
