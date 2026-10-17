type Script = "super" | "sub" | undefined;
const DIGITS = { super: "⁰¹²³⁴⁵⁶⁷⁸⁹", sub: "₀₁₂₃₄₅₆₇₈₉" };
const COMPLEX_END = /[\p{M}\p{Cf}]$/u;
const COMPLEX_START = /^[\p{M}\p{Cf}]/u;

// A view-only split: no normalization, replacement, or change to stored locators.
export function intrinsicScriptRuns(
  text: string,
  script: Script,
  before = "",
  after = "",
): { text: string; script: Script }[] {
  if (!script || !text) return [{ text, script }];
  const characters = Array.from(text);
  const runs: { text: string; script: Script }[] = [];
  for (const [index, character] of characters.entries()) {
    const intrinsic =
      DIGITS[script].includes(character) &&
      !COMPLEX_END.test(characters[index - 1] ?? before) &&
      !COMPLEX_START.test(characters[index + 1] ?? after);
    const placement = intrinsic ? undefined : script;
    const previous = runs.at(-1);
    if (previous && previous.script === placement) previous.text += character;
    else runs.push({ text: character, script: placement });
  }
  return runs;
}
