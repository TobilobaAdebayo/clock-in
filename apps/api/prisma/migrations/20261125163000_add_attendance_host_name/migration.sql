-- AlterTable: store who the visitor came to see on each attendance visit
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "host_name" TEXT;
