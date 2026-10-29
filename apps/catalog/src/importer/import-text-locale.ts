import { normalizeLanguage } from './normalize-language';
import { text } from './raw-fields';
import { InvalidRecord } from './types';
export function importTextLocale(value: unknown) {
  const locale = text(value);
  if (!locale || !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(locale))
    throw new InvalidRecord('Localized text needs a valid locale');
  return normalizeLanguage(locale) ?? locale;
}
