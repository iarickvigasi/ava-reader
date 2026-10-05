export type UserRole = "USER" | "ADMIN" | "DEVELOPER";

export type CurrentUserPayload = {
  avatarUrl: string | null;
  clerkUserId: string;
  displayName: string | null;
  email: string;
  id: string;
  role: UserRole;
  telegramUrl?: string | null;
};
