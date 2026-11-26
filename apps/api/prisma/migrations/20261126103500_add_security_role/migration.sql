-- AlterEnum: add SECURITY role for unattended front-desk check-in/out coverage
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SECURITY';
