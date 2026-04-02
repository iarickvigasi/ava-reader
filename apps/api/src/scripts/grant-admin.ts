import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const identifier = process.argv[2]?.trim();

  if (!identifier) {
    throw new Error(
      'Usage: pnpm --filter api admin:grant <primary-email-or-clerk-user-id>',
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ clerkUserId: identifier }, { primaryEmail: identifier }],
    },
  });

  if (!user) {
    throw new Error(
      `No local user was found for "${identifier}". Sign in once first so /api/me can create the row.`,
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: UserRole.ADMIN,
    },
  });

  console.log(
    `Granted ADMIN to ${updatedUser.primaryEmail} (${updatedUser.clerkUserId}).`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
