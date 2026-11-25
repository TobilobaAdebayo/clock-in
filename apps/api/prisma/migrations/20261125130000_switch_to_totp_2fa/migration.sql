-- AlterTable: store encrypted TOTP secret for Google Authenticator 2FA
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;

-- Drop unused email OTP challenge table and enum
DROP TABLE IF EXISTS "two_factor_challenges";
DROP TYPE IF EXISTS "TwoFactorPurpose";
