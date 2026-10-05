ALTER TYPE "UserRole" ADD VALUE 'DEVELOPER';
ALTER TABLE "User" ADD COLUMN "displayNameOverride" TEXT,
                   ADD COLUMN "telegramUrl" TEXT;
