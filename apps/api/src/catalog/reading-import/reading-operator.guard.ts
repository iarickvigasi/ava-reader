import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { operatorContentDigest } from './operator-content-digest';
@Injectable()
export class ReadingOperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = process.env.READING_ASSET_SYNC_SECRET;
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException(
        'Server import authorization is not configured',
      );
    const timestamp = request.get('x-reading-timestamp') ?? '';
    const signature = request.get('x-reading-signature') ?? '';
    const contentHash = request.get('x-reading-import-digest') ?? '';
    if (
      !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 300_000 ||
      !/^[a-f\d]{64}$/.test(signature) ||
      !/^[a-f\d]{64}$/.test(contentHash)
    )
      throw new UnauthorizedException('Invalid server import signature');
    const payload = {
      scope: 'reading-import-operator',
      method: request.method,
      path: request.originalUrl,
      contentHash,
    };
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException('Invalid server import signature');
    if (!request.is('multipart/form-data'))
      operatorContentDigest(
        request.method === 'GET' ? undefined : request.body,
        contentHash,
      );
    return true;
  }
}
