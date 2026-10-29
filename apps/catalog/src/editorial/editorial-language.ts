import { BadRequestException } from '@nestjs/common';
import { text } from './editorial-values';

export function editorialLanguage(value: unknown, nullable = false) {
  const language = text(value, nullable);
  if (language !== null && !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(language))
    throw new BadRequestException('Use a language code such as en, uk, or fr');
  return language;
}
