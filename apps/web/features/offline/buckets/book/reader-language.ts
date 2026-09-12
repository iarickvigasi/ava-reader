// Undefined identifies legacy metadata that has never stored a language;
// explicit null is a successful response with no known book language.
export function readKnownReaderLanguage(metadata: unknown): string | null | undefined {
  const language = (metadata as { language?: unknown } | null)?.language;
  return language === null || typeof language === "string" ? language : undefined;
}
