export type UserRole = "USER" | "ADMIN";

export type CurrentUserPayload = {
  avatarUrl: string | null;
  clerkUserId: string;
  displayName: string | null;
  email: string;
  id: string;
  role: UserRole;
};
