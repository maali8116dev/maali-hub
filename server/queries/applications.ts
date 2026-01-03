import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { applications, type Application, type NewApplication } from "../db/schema";

/**
 * Get all applications for a user
 */
export async function getUserApplications(userId: string): Promise<Application[]> {
  return await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt));
}

/**
 * Get an application by ID
 */
export async function getApplicationById(id: string): Promise<Application | null> {
  const result = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Get an application by ID and user ID (for security)
 */
export async function getUserApplication(
  id: string,
  userId: string
): Promise<Application | null> {
  const result = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);

  return result[0] || null;
}

/**
 * Get applications by project ID
 */
export async function getApplicationsByProjectId(projectId: number): Promise<Application[]> {
  return await db
    .select()
    .from(applications)
    .where(eq(applications.projectId, projectId))
    .orderBy(desc(applications.createdAt));
}

/**
 * Create a new application
 */
export async function createApplication(data: NewApplication): Promise<Application> {
  const result = await db
    .insert(applications)
    .values(data)
    .returning();

  return result[0];
}

/**
 * Update an application
 */
export async function updateApplication(
  id: string,
  userId: string,
  data: Partial<Omit<NewApplication, "id" | "userId" | "createdAt">>
): Promise<Application | null> {
  const result = await db
    .update(applications)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  return result[0] || null;
}

/**
 * Delete an application
 */
export async function deleteApplication(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  status: string
): Promise<Application | null> {
  const result = await db
    .update(applications)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id))
    .returning();

  return result[0] || null;
}

