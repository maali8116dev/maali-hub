import { eq } from "drizzle-orm";
import { db } from "../db";
import { profiles, type Profile, type NewProfile } from "../db/schema";

/**
 * Get a profile by user ID
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get a profile by ID
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Create a new profile
 */
export async function createProfile(data: NewProfile): Promise<Profile> {
  const result = await db
    .insert(profiles)
    .values(data)
    .returning();

  return result[0];
}

/**
 * Update a profile
 */
export async function updateProfile(
  userId: string,
  data: Partial<Omit<NewProfile, "id" | "userId" | "createdAt">>
): Promise<Profile | null> {
  const result = await db
    .update(profiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  return result[0] || null;
}

/**
 * Delete a profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  const result = await db
    .delete(profiles)
    .where(eq(profiles.userId, userId))
    .returning();

  return result.length > 0;
}

