// Cyrillic (Russian + Ukrainian) and a few common Latin-with-diacritics
// mappings. Anything else that isn't [a-z0-9] gets collapsed to a hyphen.
const TRANSLITERATION_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  á: 'a',
  à: 'a',
  ä: 'a',
  â: 'a',
  ã: 'a',
  å: 'a',
  é: 'e',
  è: 'e',
  ë: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  ï: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ö: 'o',
  ô: 'o',
  õ: 'o',
  ø: 'o',
  ú: 'u',
  ù: 'u',
  ü: 'u',
  û: 'u',
  ý: 'y',
  ÿ: 'y',
  ñ: 'n',
  ç: 'c',
  ß: 'ss',
};

function transliterate(input: string) {
  let output = '';

  for (const ch of input.toLowerCase()) {
    output += TRANSLITERATION_MAP[ch] ?? ch;
  }

  return output;
}

export function slugifyPart(input: string) {
  return transliterate(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clampSlug(input: string, maxLength: number) {
  if (input.length <= maxLength) {
    return input;
  }

  return input.slice(0, maxLength).replace(/-+$/, '');
}

export async function resolveUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
) {
  if (!(await isTaken(base))) {
    return base;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;

    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
}
