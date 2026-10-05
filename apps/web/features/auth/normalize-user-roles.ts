import { UserRole } from "@/lib/api-types/user";

// Only cached legacy profiles use scalar roles. An explicit empty array wins after revocation.
export function normalizeUserRoles<
  T extends { roles?: unknown; role?: unknown },
>(user: T): T & { roles: UserRole[] } {
  const values = Array.isArray(user.roles) ? user.roles : [user.role];
  const roles = [
    ...new Set(
      values.filter(
        (role): role is UserRole =>
          role === UserRole.ADMIN || role === UserRole.DEVELOPER,
      ),
    ),
  ].sort();
  const normalized = { ...user, roles };
  delete normalized.role;
  return normalized;
}
