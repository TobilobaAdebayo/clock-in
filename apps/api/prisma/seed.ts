import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/shared/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (no demo accounts or sample visitors)...');

  // 1. Seed Default Workspace Settings
  const defaultSettings = [
    { key: 'workspace_name', value: process.env.WORKSPACE_NAME || 'Dare Adeboye Innovation Hub' },
    { key: 'workspace_timezone', value: process.env.WORKSPACE_TIMEZONE || 'Africa/Lagos' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
    console.log(` ✅ Setting configured: ${setting.key} = "${setting.value}"`);
  }

  // 2. Seed Initial Super Admin Account (Argon2id hashed password)
  const isProd = process.env.NODE_ENV === 'production';
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@clockin.workspace').toLowerCase().trim();
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || (isProd ? '' : 'SuperAdmin123!');

  if (isProd && (!process.env.SUPER_ADMIN_EMAIL || adminPassword.length < 12)) {
    throw new Error(
      'In production, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (min 12 chars) must be set explicitly before seeding.',
    );
  }

  const adminPasswordHash = await hashPassword(adminPassword);

  const superAdmin = await prisma.staff.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      fullName: 'System Administrator',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(` ✅ Super Admin ready: ${superAdmin.email}`);
  console.log('🎉 Database seeding completed cleanly.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
