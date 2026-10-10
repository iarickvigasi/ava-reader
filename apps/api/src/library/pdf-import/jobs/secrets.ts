import { createHash, timingSafeEqual } from 'node:crypto';
export function secretDigest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function matchesSecret(value: unknown, expected: string) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(value) ||
    !/^[a-f0-9]{64}$/.test(expected)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(secretDigest(value), 'hex'),
    Buffer.from(expected, 'hex'),
  );
}
