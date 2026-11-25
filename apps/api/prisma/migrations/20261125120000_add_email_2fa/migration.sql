-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TwoFactorPurpose" AS ENUM ('LOGIN', 'ENABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: add two_factor_enabled column to staff
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: two_factor_challenges
CREATE TABLE IF NOT EXISTS "two_factor_challenges" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "purpose" "TwoFactorPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "two_factor_challenges_staff_id_purpose_idx" ON "two_factor_challenges"("staff_id", "purpose");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "two_factor_challenges"
        ADD CONSTRAINT "two_factor_challenges_staff_id_fkey"
        FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
