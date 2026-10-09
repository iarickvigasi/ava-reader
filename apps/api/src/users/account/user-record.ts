import type { User, UserRole } from '@prisma/client';

export type UserRecord = User & { roles: UserRole[] };

export function toUserRecord(
  user: User & { roleMemberships: { role: UserRole }[] },
): UserRecord {
  const { roleMemberships, ...record } = user;
  return {
    ...record,
    displayName: record.displayNameOverride ?? record.displayName,
    roles: roleMemberships.map(({ role }) => role).sort(),
  };
}
