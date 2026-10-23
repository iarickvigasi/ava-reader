import type { Raw } from './types';

const LANGUAGES: Record<string, string> = {
  eng: 'en',
  rus: 'ru',
  ara: 'ar',
  fra: 'fr',
  fre: 'fr',
  deu: 'de',
  ger: 'de',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  zho: 'zh',
  chi: 'zh',
  jpn: 'ja',
  kor: 'ko',
  ukr: 'uk',
  srp: 'sr',
  hrv: 'hr',
  pol: 'pl',
  nld: 'nl',
  dut: 'nl',
  hin: 'hi',
};

export function normalizeLanguage(value: unknown): string | undefined {
  const key = value && typeof value === 'object' ? (value as Raw).key : value;
  if (typeof key !== 'string') return undefined;
  const code = key.replace(/^\/languages\//, '').toLowerCase();
  if (!/^[a-z]{2,3}$/.test(code)) return undefined;
  return LANGUAGES[code] ?? code;
}
