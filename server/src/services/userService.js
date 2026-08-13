import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const getUserByEmail = async (email) => {
  return db.query.user.findFirst({ where: eq(user.email, email) });
};

export const getUserById = async (id) => {
  return db.query.user.findFirst({ where: eq(user.id, id) });
};

export const updateUserProfile = async (id, data) => {
  const [updated] = await db
    .update(user)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(user.id, id))
    .returning();
  return updated;
};

export const deleteUserById = async (id) => {
  const [deleted] = await db.delete(user).where(eq(user.id, id)).returning();
  return deleted;
};
