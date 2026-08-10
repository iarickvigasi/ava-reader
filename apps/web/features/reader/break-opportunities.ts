// Where a long token may be broken so it never outgrows a reader column. A
// column is a page, and an over-wide line paints into the next one (see spec
// 1.1-content-rendering). `break-words` on the article guarantees the line
// fits; these points decide where the break lands, so a bare URL folds after a
// slash the way a printed citation does instead of mid-word.

// Break *after* these, and treat a run of them as one opportunity — otherwise
// a scheme folds as `https:/` + `/`.
const BREAK_AFTER_CHARACTERS = new Set([...":/\\-_.?&=#%~+,;"]);

// Shortest token worth breaking. A mobile column holds ~24 characters at
// MAX_FONT_SCALE, so nothing shorter can overflow, and leaving the rest alone
// keeps `e.g.` and `well-known` folding exactly as they did before.
const MIN_BREAKABLE_TOKEN_LENGTH = 16;

const WHITESPACE = /\s/;

// Splits `text` at its break opportunities. The caller renders a <wbr> between
// the parts — an element, so it adds no characters and every saved locator
// offset stays valid. Returns a single part when there is nothing to break.
export function splitAtBreakOpportunities(text: string): string[] {
  const cutPoints = collectCutPoints(text);

  if (cutPoints.length === 0) {
    return [text];
  }

  const parts: string[] = [];
  let partStart = 0;

  for (const cutPoint of cutPoints) {
    parts.push(text.slice(partStart, cutPoint));
    partStart = cutPoint;
  }
  parts.push(text.slice(partStart));

  return parts;
}

function collectCutPoints(text: string) {
  const cutPoints: number[] = [];
  let tokenStart = 0;

  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && !WHITESPACE.test(text[index])) {
      continue;
    }

    if (index - tokenStart >= MIN_BREAKABLE_TOKEN_LENGTH) {
      appendTokenCutPoints(text, tokenStart, index, cutPoints);
    }
    tokenStart = index + 1;
  }

  return cutPoints;
}

function appendTokenCutPoints(
  text: string,
  tokenStart: number,
  tokenEnd: number,
  cutPoints: number[],
) {
  let index = tokenStart;

  while (index < tokenEnd) {
    if (!BREAK_AFTER_CHARACTERS.has(text[index])) {
      index += 1;
      continue;
    }

    let runEnd = index + 1;
    while (runEnd < tokenEnd && BREAK_AFTER_CHARACTERS.has(text[runEnd])) {
      runEnd += 1;
    }

    // A cut at the token's end would only produce an empty trailing part, and
    // breaking inside a number (`1,234`, an ISBN) reads as a typo.
    const isTokenEnd = runEnd === tokenEnd;
    if (!isTokenEnd && !isBetweenDigits(text, index, runEnd)) {
      cutPoints.push(runEnd);
    }

    index = runEnd;
  }
}

function isBetweenDigits(text: string, runStart: number, runEnd: number) {
  return isDigit(text[runStart - 1]) && isDigit(text[runEnd]);
}

function isDigit(character: string | undefined) {
  return character !== undefined && character >= "0" && character <= "9";
}
