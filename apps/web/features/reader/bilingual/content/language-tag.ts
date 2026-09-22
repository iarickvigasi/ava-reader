let names: Map<string, string> | null = null;

export function bilingualLanguageTag(language: string): string | undefined {
  if (language === "Chinese (Simplified)") return "zh-Hans";
  if (language === "Chinese (Traditional)") return "zh-Hant";
  if (language === "Frisian (West)") return "fy";
  if (!names) {
    names = new Map();
    const display = new Intl.DisplayNames(["en"], { type: "language" });
    const codes = ["fil", "haw", "sco", "ceb", "yue"];
    for (let first = 97; first <= 122; first += 1) {
      for (let second = 97; second <= 122; second += 1) {
        codes.push(String.fromCharCode(first, second));
      }
    }
    for (const code of codes)
      names.set(display.of(code)?.toLowerCase() ?? code, code);
  }
  return names.get(language.toLowerCase());
}
