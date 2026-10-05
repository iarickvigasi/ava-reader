import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type UserRole } from '@prisma/client';
import { changeRole } from '../users/change-role';

export async function runRoleCommand(
  role: UserRole,
  action: 'grant' | 'revoke',
) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:15432/ava_reader?schema=public',
    }),
  });
  try {
    const identifier = process.argv[2]?.trim();
    if (!identifier)
      throw new Error(
        `Usage: pnpm --filter api ${role.toLowerCase()}:${action} <email-or-clerk-user-id>`,
      );
    const user = await changeRole(prisma, { identifier, role, action });
    console.log(
      `${action === 'grant' ? 'Granted' : 'Revoked'} ${role}: ${user.primaryEmail}.`,
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
