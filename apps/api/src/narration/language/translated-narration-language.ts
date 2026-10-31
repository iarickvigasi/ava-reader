import { NARRATION_LANGUAGE_CODES } from './supported-languages';

// A completed translation has a known output language. Reuse it when its script agrees;
// foreign-script preserved names still need contextual identification, like source selections.
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
  // Latin spelling can preserve a Japanese/French name unchanged in an English translation.
  if (script === 'Latn') return null;
  const scripts = (
    {
      Jpan: ['Hani', 'Hira', 'Kana'],
      Kore: ['Hang', 'Hani'],
      Hans: ['Hani'],
      Hant: ['Hani'],
    } as Record<string, string[]>
  )[script] ?? [script];
  const expression = new RegExp(
    scripts.map((value) => `\\p{Script=${value}}`).join('|'),
    'u',
  );
  return letters.filter((letter) => expression.test(letter)).length /
    letters.length >=
    0.8
    ? code
    : null;
}
