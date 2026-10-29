import { createHash, timingSafeEqual } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
export function operatorContentDigest(content?: unknown, expected?: string) {
  let canonical = '';
  try {
    if (content !== undefined)
      canonical = JSON.stringify(
        typeof content === 'string' ? JSON.parse(content) : content,
      );
  } catch {
    throw new BadRequestException('Invalid import JSON');
  }
  const digest = createHash('sha256').update(canonical).digest('hex');
  if (
    expected !== undefined &&
    (!/^[a-f\d]{64}$/.test(expected) ||
      !timingSafeEqual(
        Buffer.from(digest, 'hex'),
        Buffer.from(expected, 'hex'),
      ))
  )
    throw new UnauthorizedException('Import content does not match signature');
  return digest;
}
