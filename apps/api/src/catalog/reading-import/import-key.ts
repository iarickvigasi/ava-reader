import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

export function importKey(editionId: string, checksum: string) {
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      editionId,
    ) ||
    !/^[\da-f]{64}$/.test(checksum)
  )
    throw new BadRequestException('Invalid edition/checksum identity');
  return createHash('sha256')
    .update(`open-library:${editionId}:${checksum}`)
    .digest('hex');
}
