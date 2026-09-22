import { BadRequestException, ConflictException } from '@nestjs/common';
import type { GenerateTranslationRequest } from '../dto';
import { MAX_TRANSLATION_CHARACTERS, type TranslationContext } from '../types';

export function selectTranslationSentences(
  context: TranslationContext,
  request: GenerateTranslationRequest,
) {
  if (
    context.contentRevision !== request.contentRevision ||
    context.translationVersion !== request.translationVersion
  ) {
    throw new ConflictException(
      'The book or translation version changed. Reload its sentences.',
    );
  }
  const catalog = new Map(context.units.map((unit) => [unit.id, unit]));
  const selected = request.sentenceIds.map((id) => {
    const sentence = catalog.get(id);
    if (!sentence || sentence.kind !== 'sentence') {
      throw new BadRequestException(
        'A requested sentence does not belong to this chapter.',
      );
    }
    return sentence;
  });
  if (
    selected.reduce((length, sentence) => length + sentence.text.length, 0) >
    MAX_TRANSLATION_CHARACTERS
  ) {
    throw new BadRequestException(
      'The requested sentences contain too much text.',
    );
  }
  return selected;
}
