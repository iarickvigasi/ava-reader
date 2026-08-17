import { BadRequestException } from '@nestjs/common';
import type { ReaderLocator } from '../reader-types';

export function parseLocator(value: string | null): ReaderLocator | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReaderLocator>;

    if (
      typeof parsed.chapterId !== 'string' ||
      typeof parsed.blockId !== 'string' ||
      typeof parsed.textOffset !== 'number'
    ) {
      return null;
    }

    return {
      blockId: parsed.blockId,
      chapterId: parsed.chapterId,
      textOffset: parsed.textOffset,
    };
  } catch {
    return null;
  }
}

export function validateLocator(locator: ReaderLocator) {
  if (!locator || Number.isNaN(locator.textOffset) || locator.textOffset < 0) {
    throw new BadRequestException('A valid reader locator is required.');
  }
}
