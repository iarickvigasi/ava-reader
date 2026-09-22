import { BadRequestException, ConflictException } from '@nestjs/common';
import { selectTranslationSentences } from './select-sentences';
import { translationContext } from '../testing/translation.fixture';

describe('translation sentence selection', () => {
  const context = translationContext();
  const request = {
    ...context,
    sentenceIds: context.units.map((unit) => unit.id),
  };

  it('rejects stale source/prompt versions and sentence IDs outside the owned chapter', () => {
    expect(() =>
      selectTranslationSentences(context, {
        ...request,
        contentRevision: 'old',
      }),
    ).toThrow(ConflictException);
    expect(() =>
      selectTranslationSentences(context, {
        ...request,
        translationVersion: 2,
      }),
    ).toThrow(ConflictException);
    expect(() =>
      selectTranslationSentences(context, {
        ...request,
        sentenceIds: ['other-book'],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      selectTranslationSentences(
        {
          ...context,
          units: [{ ...context.units[0], text: 'a'.repeat(32769) }],
        },
        { ...request, sentenceIds: [context.units[0].id] },
      ),
    ).toThrow(BadRequestException);
  });
});
