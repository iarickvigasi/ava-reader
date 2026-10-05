BEGIN;
-- Schema only: production has no elevated roles. Preserve localhost assignments separately.
ALTER TABLE "User" DROP COLUMN "role";
ALTER TYPE "UserRole" RENAME TO "LegacyUserRole";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEVELOPER');
DROP TYPE "LegacyUserRole";

CREATE TABLE "UserRoleMembership" (
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRoleMembership_pkey" PRIMARY KEY ("userId", "role"),
    CONSTRAINT "UserRoleMembership_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserRoleMembership_role_userId_idx" ON "UserRoleMembership"("role", "userId");
COMMIT;
