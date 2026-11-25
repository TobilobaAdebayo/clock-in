-- AlterTable: remove payment_frequency column from visitors
ALTER TABLE "visitors" DROP COLUMN IF EXISTS "payment_frequency";

-- DropEnum: remove PaymentFrequency enum
DROP TYPE IF EXISTS "PaymentFrequency";
