export function splitGenreTokens(value: string) {
  const numbered = /^\s*\d+\.\s+/.test(value) && /\S\s+\d+\.\s+/.test(value);
  const separator = numbered
    ? /,|\s+(?:--|-)\s+|(?:^|\s+)\d+\.\s+/g
    : /,|\s+(?:--|-)\s+/g;

  return value
    .trim()
    .split(separator)
    .map((token) =>
      numbered ? token.trim().replace(/\.$/, '').trim() : token.trim(),
    )
    .filter((token) => token.length > 0);
}
