import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export function verifyPublication(
  body: unknown,
  timestamp: string,
  signature: string,
) {
  const secret = process.env.READING_ASSET_SYNC_SECRET;
  if (!secret || secret.length < 32)
    throw new ServiceUnavailableException(
      'Publication synchronization is not configured',
    );
  if (
    !/^\d{13}$/.test(timestamp ?? '') ||
    Math.abs(Date.now() - Number(timestamp)) > 300_000 ||
    !/^[a-f\d]{64}$/.test(signature ?? '')
  )
    throw new UnauthorizedException();
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    throw new UnauthorizedException();
}
