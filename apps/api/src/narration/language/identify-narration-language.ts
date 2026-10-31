import { narrationFailure } from '../narration-failure';
import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { cacheLanguageDecision } from './decision-cache';
import { retryLanguageDecision } from './retry-language-decision';
import { topScoringLanguage } from './top-scoring-language';
import {
  LANGUAGE_MODEL,
  requestLanguageDecision,
  type NarrationLanguageInput,
} from './request-language-decision';

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
    try {
      const answer = await retryLanguageDecision(() =>
        requestLanguageDecision(config, input),
      );
      return topScoringLanguage(answer);
    } catch (error: unknown) {
      throw narrationFailure('language', error);
    }
  });
}
