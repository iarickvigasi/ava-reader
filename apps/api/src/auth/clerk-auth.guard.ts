import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';
import { ClerkAuthService } from './clerk-auth.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly clerkAuthService: ClerkAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const session = await this.clerkAuthService.authenticateSessionToken(token);
    request.auth = {
      clerkUserId: session.clerkUserId,
      token,
    };

    return true;
  }
}
