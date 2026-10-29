import { BadRequestException } from '@nestjs/common';
import { CreditRole } from '#catalog-client';
import { rows, text } from './editorial-values';

export function editorialCredits(value: unknown) {
  return rows(value).map((row, position) => {
    if (
      !Object.values(CreditRole).includes(row.role as CreditRole) ||
      !/^[a-f\d-]{36}$/i.test(String(row.authorId))
    )
      throw new BadRequestException('Invalid author credit');
    return {
      authorId: String(row.authorId),
      role: row.role as CreditRole,
      creditedAs: text(row.creditedAs, true),
      position,
    };
  });
}
