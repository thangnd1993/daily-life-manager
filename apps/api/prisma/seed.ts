import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Administrator';
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for admin bootstrap');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.user.upsert({
    where: { email },
    create: { email, displayName, passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    update: { displayName, passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  });
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Admin seed failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
