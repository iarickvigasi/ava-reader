import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { verifyPublication } from './verify-publication';

@Injectable()
export class PublicStorageGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    verifyPublication(
      { operation: 'public-storage' },
      String(request.headers['x-reading-timestamp'] ?? ''),
      String(request.headers['x-reading-auth'] ?? ''),
    );
    return true;
  }
}
