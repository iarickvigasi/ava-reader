import { createHash } from 'node:crypto';
import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { cacheLanguageDecision } from './decision-cache';
import { NARRATION_LANGUAGE_CODES } from './supported-languages';
import {
  LANGUAGE_MODEL,
  requestLanguageDecision,
  type NarrationLanguageInput,
} from './request-language-decision';

// Initial conservative policy, verified on authored examples, not population calibration.
const MIN_PROBABILITY = 0.8;
const MIN_MARGIN = 0.2;

export async function identifyNarrationLanguage(
  config: ConfigService,
  input: NarrationLanguageInput,
  accountId: string,
): Promise<string> {
  // Kana identifies Japanese directly only for kana-only selections; Han may contain a foreign quotation.
  if (
    /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(input.text) &&
    /^[\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{N}\p{Z}\sー]+$/u.test(
      input.text,
    )
  )
    return 'ja';
  const key = createHash('sha256')
    .update(JSON.stringify([accountId, LANGUAGE_MODEL, input]))
    .digest('hex');
  return cacheLanguageDecision(key, async () => {
    let answer;
    try {
      answer = await requestLanguageDecision(config, input);
    } catch {
      throw new ServiceUnavailableException(
        'Language identification failed. Please try again.',
      );
    }
    const selected = answer.probabilities[answer.choice] ?? 0;
    const runnerUp = Math.max(
      0,
      ...Object.entries(answer.probabilities)
        .filter(([code]) => code !== answer.choice)
        .map(([, probability]) => probability),
    );
    if (
      !NARRATION_LANGUAGE_CODES.includes(answer.choice) ||
      selected < MIN_PROBABILITY ||
      selected - runnerUp < MIN_MARGIN
    ) {
      throw new UnprocessableEntityException({
        code: 'NARRATION_LANGUAGE_UNCERTAIN',
        message: 'Select a longer phrase in one language and try again.',
      });
    }
    return answer.choice;
  });
}
