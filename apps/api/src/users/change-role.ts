import type { PrismaClient, UserRole } from '@prisma/client';

type RoleChange = {
  identifier: string;
  role: UserRole;
  action: 'grant' | 'revoke';
};

export async function changeRole(prisma: PrismaClient, change: RoleChange) {
  const { identifier, role, action } = change;
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { clerkUserId: identifier },
        { primaryEmail: { equals: identifier, mode: 'insensitive' } },
      ],
    },
    select: { id: true, primaryEmail: true },
    take: 2,
  });
  if (users.length !== 1)
    throw new Error(
      'Expected exactly one existing user; use Clerk ID for ambiguous emails.',
    );
  const user = users[0];
  if (action === 'grant') {
    await prisma.userRoleMembership.createMany({
      data: [{ userId: user.id, role }],
      skipDuplicates: true,
    });
  } else {
    await prisma.userRoleMembership.deleteMany({
      where: { userId: user.id, role },
    });
  }
  return user;
}
