import { NARRATION_LANGUAGE_CODES } from './supported-languages';

const aliases: Record<string, string[]> = {
  Jpan: ['Hani', 'Hira', 'Kana'],
  Kore: ['Hang', 'Hani'],
  Hans: ['Hani'],
  Hant: ['Hani'],
};
const scriptOwners = new Map<string, Set<string>>();
for (const language of NARRATION_LANGUAGE_CODES) {
  const script = new Intl.Locale(language).maximize().script;
  for (const part of script ? (aliases[script] ?? [script]) : []) {
    const owners = scriptOwners.get(part) ?? new Set<string>();
    owners.add(language);
    scriptOwners.set(part, owners);
  }
}

// A translated fragment may preserve a foreign quotation or name. Only an exclusive script
// is sufficient to skip contextual detection; Han, Cyrillic, Arabic and Latin are shared.
export function translatedNarrationLanguage(input: {
  text: string;
  translationLanguage?: string;
}): string | null {
  const code = input.translationLanguage;
  if (!code || !NARRATION_LANGUAGE_CODES.includes(code)) return null;
  const letters = input.text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return null;
  const script = new Intl.Locale(code).maximize().script;
  if (!script) return null;
  const exclusive = (aliases[script] ?? [script]).filter(
    (part) => scriptOwners.get(part)?.size === 1,
  );
  if (!exclusive.length) return null;
  const expression = new RegExp(
    exclusive.map((value) => `\\p{Script=${value}}`).join('|'),
    'u',
  );
  return letters.every((letter) => expression.test(letter)) ? code : null;
}
