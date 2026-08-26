import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.mjs';
import { db } from '../src/db/index.js';
import { balances } from '../src/db/schema.js';
import { getUserByEmail, updateUserProfile } from '../src/services/userService.js';
import { requireEnv } from '../src/config/requiredEnv.js';

dotenv.config();

const USERS = [
  {
    email: requireEnv('SEED_ADMIN_EMAIL'),
    password: requireEnv('SEED_ADMIN_PASSWORD'),
    name: process.env.SEED_ADMIN_NAME || 'Admin User',
    role: 'admin',
  },
  {
    email: requireEnv('SEED_CLIENT_EMAIL'),
    password: requireEnv('SEED_CLIENT_PASSWORD'),
    name: process.env.SEED_CLIENT_NAME || 'Client User',
    role: 'client',
  },
];

async function ensureBalance(userId) {
  const existing = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if (!existing) {
    await db.insert(balances).values({ userId, amount: '0' });
  }
}

async function ensureUser({ email, password, name, role }) {
  let profile = await getUserByEmail(email);

  if (!profile) {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    if (result?.error) {
      throw new Error(`Failed to sign up ${email}: ${result.error.message}`);
    }
    profile = await getUserByEmail(email);
    console.log(`Created ${email}`);
  } else {
    console.log(`Found existing ${email}`);
  }

  if (!profile) throw new Error(`User not found after signup: ${email}`);

  if (profile.role !== role) {
    profile = await updateUserProfile(profile.id, { role });
    console.log(`Set ${email} role -> ${role}`);
  }

  await ensureBalance(profile.id);
  return profile;
}

async function main() {
  for (const entry of USERS) {
    await ensureUser(entry);
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
