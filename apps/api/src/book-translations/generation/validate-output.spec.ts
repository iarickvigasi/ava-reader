import { BadGatewayException } from '@nestjs/common';
import { validateTranslationOutput } from './validate-output';
import { translationContext } from '../testing/translation.fixture';

describe('translation response validation', () => {
  const sentences = translationContext().units;
  const entries = sentences.map((unit) => ({ id: unit.id, text: 'Bonjour.' }));
  it('rejects missing, duplicate, foreign IDs and blank or malformed results', () => {
    for (const translations of [
      entries.slice(1),
      [entries[0], entries[0]],
      [...entries, { id: 'foreign', text: 'No' }],
      entries.map((entry) => ({ ...entry, text: ' ' })),
    ]) {
      expect(() =>
        validateTranslationOutput({ translations }, sentences),
      ).toThrow(BadGatewayException);
    }
    expect(() => validateTranslationOutput('invalid', sentences)).toThrow(
      BadGatewayException,
    );
  });

  it('matches by IDs even when the model returns sentences in another order', () => {
    expect(
      validateTranslationOutput(
        { translations: entries.toReversed() },
        sentences,
      ),
    ).toEqual(
      Object.fromEntries(entries.map((entry) => [entry.id, entry.text])),
    );
  });
});
