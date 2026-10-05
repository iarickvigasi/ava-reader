export const UserRole = {
  ADMIN: "ADMIN",
  DEVELOPER: "DEVELOPER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type CurrentUserPayload = {
  avatarUrl: string | null;
  clerkUserId: string;
  displayName: string | null;
  email: string;
  id: string;
  roles: UserRole[];
  telegramUrl?: string | null;
};
