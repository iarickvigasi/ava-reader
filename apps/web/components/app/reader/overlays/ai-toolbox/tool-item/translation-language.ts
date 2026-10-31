import { bilingualLanguageTag } from "@/features/reader/bilingual/content/language-tag";

export function languageCode(value: string | null): string | null {
  if (!value) return null;
  const tag = bilingualLanguageTag(value) ?? value;
  try {
    const language = new Intl.Locale(tag).language;
    return ["und", "mul", "zxx"].includes(language) ? null : language;
  } catch {
    return null;
  }
}
