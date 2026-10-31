import { NARRATION_LANGUAGE_CODES } from './supported-languages';

const supported = new Set(NARRATION_LANGUAGE_CODES);

export function topScoringLanguage(answer: {
  choice: string;
  probabilities: Record<string, number>;
}): string {
  let winner: string | undefined;
  let score = 0;
  for (const [language, probability] of Object.entries(answer.probabilities)) {
    if (!supported.has(language)) continue;
    if (
      probability > score ||
      (probability > 0 && probability === score && language === answer.choice)
    ) {
      winner = language;
      score = probability;
    }
  }
  if (!winner)
    throw new Error('Language provider returned no supported language scores.');
  return winner;
}
