import { generateTranslationSchema } from './dto';
import { translationContext } from './testing/translation.fixture';

describe('translation request validation', () => {
  const context = translationContext();
  const request = {
    ...context,
    sentenceIds: context.units.map((unit) => unit.id),
  };

  it('accepts only bounded, unique IDs and normalizes language whitespace', () => {
    expect(
      generateTranslationSchema.parse({ ...request, targetLang: ' French ' })
        .targetLang,
    ).toBe('French');
    expect(
      generateTranslationSchema.safeParse({
        ...request,
        sentenceIds: Array(65).fill('id'),
      }).success,
    ).toBe(false);
    expect(
      generateTranslationSchema.safeParse({
        ...request,
        sentenceIds: ['id', 'id'],
      }).success,
    ).toBe(false);
    expect(
      generateTranslationSchema.safeParse({ ...request, sentenceIds: [] })
        .success,
    ).toBe(false);
  });
});
