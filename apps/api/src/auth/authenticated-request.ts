import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  auth: {
    clerkUserId: string;
    token: string;
  };
};
