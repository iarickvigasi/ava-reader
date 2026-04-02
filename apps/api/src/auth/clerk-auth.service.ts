import { createClerkClient, verifyToken } from '@clerk/backend';
import type { ClerkClient, User } from '@clerk/backend';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type VerifiedToken = Awaited<ReturnType<typeof verifyToken>>;

@Injectable()
export class ClerkAuthService {
  private clerkClient: ClerkClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  async authenticateSessionToken(
    token: string,
  ): Promise<{ clerkUserId: string }> {
    try {
      const claims = await verifyToken(token, {
        secretKey: this.getRequiredEnv('CLERK_SECRET_KEY'),
        jwtKey: this.configService.get<string>('CLERK_JWT_KEY') ?? undefined,
        authorizedParties: this.getAuthorizedParties(),
      });

      const clerkUserId = this.getSubject(claims);

      return {
        clerkUserId,
      };
    } catch {
      throw new UnauthorizedException('The provided Clerk token is invalid.');
    }
  }

  async getUser(clerkUserId: string): Promise<User> {
    return this.getClerkClient().users.getUser(clerkUserId);
  }

  private getClerkClient() {
    if (!this.clerkClient) {
      this.clerkClient = createClerkClient({
        secretKey: this.getRequiredEnv('CLERK_SECRET_KEY'),
        publishableKey:
          this.configService.get<string>('CLERK_PUBLISHABLE_KEY') ?? undefined,
        jwtKey: this.configService.get<string>('CLERK_JWT_KEY') ?? undefined,
      });
    }

    return this.clerkClient;
  }

  private getAuthorizedParties() {
    const configuredParties =
      this.configService.get<string>('CLERK_AUTHORIZED_PARTIES') ?? '';
    const parties = configuredParties
      .split(',')
      .map((party) => party.trim())
      .filter(Boolean);

    return parties.length > 0 ? parties : undefined;
  }

  private getRequiredEnv(name: string) {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new InternalServerErrorException(
        `${name} must be configured for Clerk authentication.`,
      );
    }

    return value;
  }

  private getSubject(claims: VerifiedToken) {
    if (!claims.sub) {
      throw new UnauthorizedException(
        'The provided Clerk token is missing a subject.',
      );
    }

    return claims.sub;
  }
}
