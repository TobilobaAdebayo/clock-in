-- AlterTable: make phone_number optional on visitors (PostgreSQL UNIQUE still enforces uniqueness for non-null phones)
ALTER TABLE "visitors" ALTER COLUMN "phone_number" DROP NOT NULL;
