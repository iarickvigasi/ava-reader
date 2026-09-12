export type SelectionMode = "word" | "grapheme";

const WORD_SCRIPTS = new Set(["Latn", "Cyrl", "Grek"]);
const UNSPECIFIED_LANGUAGES = new Set(["und", "mul", "zxx"]);
const LEGACY_LANGUAGES: Record<string, string> = {
  english: "en",
  french: "fr",
  german: "de",
  spanish: "es",
  italian: "it",
  portuguese: "pt",
  dutch: "nl",
  russian: "ru",
  ukrainian: "uk",
  serbian: "sr",
  greek: "el",
  japanese: "ja",
  chinese: "zh",
  arabic: "ar",
  korean: "ko",
  hebrew: "he",
  persian: "fa",
  hindi: "hi",
  thai: "th",
  vietnamese: "vi",
};

// Resolve from metadata once per book opening; gestures never inspect text scripts.
export function selectionModeForLanguage(
  language: string | null | undefined,
): SelectionMode {
  const normalized = language?.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) return "grapheme";
  try {
    const locale = new Intl.Locale(LEGACY_LANGUAGES[normalized] ?? normalized);
    if (UNSPECIFIED_LANGUAGES.has(locale.language)) return "grapheme";
    // Syntactically valid but unknown codes must not inherit a guessed script.
    if (!new Intl.Locale(locale.language).maximize().script) return "grapheme";
    const script = locale.script ?? locale.maximize().script;
    return script && WORD_SCRIPTS.has(script) ? "word" : "grapheme";
  } catch {
    return "grapheme";
  }
}
