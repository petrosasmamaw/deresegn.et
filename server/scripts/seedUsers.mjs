import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.mjs';
import { db } from '../src/db/index.js';
import { user, balances } from '../src/db/schema.js';
import { getUserByEmail, updateUserProfile } from '../src/services/userService.js';

dotenv.config();

const USERS = [
  { email: 'admin@gmail.com', password: '12345678', name: 'Admin User', role: 'admin' },
  { email: 'mistrasmamaw@gmail.com', password: '12345678', name: 'Petros Client', role: 'client' },
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
