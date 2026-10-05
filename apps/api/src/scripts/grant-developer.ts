import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ava_reader?schema=public',
});
const prisma = new PrismaClient({ adapter });
async function main() {
  const identifier = process.argv[2]?.trim();
  if (!identifier)
    throw new Error(
      'Usage: pnpm --filter api developer:grant <email-or-clerk-user-id>',
    );
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { clerkUserId: identifier },
        { primaryEmail: { equals: identifier, mode: 'insensitive' } },
      ],
    },
  });
  if (users.length !== 1)
    throw new Error(
      'Expected exactly one existing user; use Clerk ID for ambiguous emails.',
    );
  const user = users[0];
  if (user.role === 'ADMIN')
    throw new Error(
      'This single-role model cannot combine ADMIN and DEVELOPER. No change made.',
    );
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'DEVELOPER' },
  });
  console.log(`Granted DEVELOPER to ${user.primaryEmail}.`);
}
void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
