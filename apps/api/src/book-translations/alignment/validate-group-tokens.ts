import type { AlignmentToken } from './alignment-tokens';
import { AlignmentValidationError } from './alignment-output';

export function validateGroupTokens(
  ids: number[],
  echoes: string[],
  tokens: AlignmentToken[],
  side: string,
): void {
  if (echoes.length !== ids.length)
    throw new AlignmentValidationError(
      `Mismatched ${side} token text count. Echo one exact text per ID.`,
    );
  const selected = ids.map((id, index) => {
    const token = tokens[id];
    if (!token)
      throw new AlignmentValidationError(`Invalid ${side} token ID ${id}.`);
    if (token.text !== echoes[index])
      throw new AlignmentValidationError(
        `Mismatched ${side} token ${id}: expected ${JSON.stringify(token.text)}, received ${JSON.stringify(echoes[index])}. Recheck all matches in this sentence against the supplied IDs.`,
      );
    return token;
  });
  const words = selected.filter((token) =>
    /[\p{L}\p{N}\p{S}]/u.test(token.text),
  );
  if (!words.length)
    throw new AlignmentValidationError(
      `Punctuation-only ${side} group. Re-align the entire sentence by meaning, leaving standalone punctuation unmatched.`,
    );
  if (words.length > 6)
    throw new AlignmentValidationError(
      `Overly broad ${side} group: ${words.length} words. Split into individual word equivalents first; use a phrase only for an inseparable meaning (at most 6 words per side).`,
    );
}
