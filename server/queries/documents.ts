import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  applicationDocuments,
  type ApplicationDocument,
  type NewApplicationDocument,
} from "../db/schema";

/**
 * Get all documents for an application
 */
export async function getApplicationDocuments(
  applicationId: string
): Promise<ApplicationDocument[]> {
  return await db
    .select()
    .from(applicationDocuments)
    .where(eq(applicationDocuments.applicationId, applicationId));
}

/**
 * Get all documents for a user
 */
export async function getUserDocuments(userId: string): Promise<ApplicationDocument[]> {
  return await db
    .select()
    .from(applicationDocuments)
    .where(eq(applicationDocuments.userId, userId));
}

/**
 * Get a document by ID
 */
export async function getDocumentById(id: string): Promise<ApplicationDocument | null> {
  const result = await db
    .select()
    .from(applicationDocuments)
    .where(eq(applicationDocuments.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Get a document by ID and user ID (for security)
 */
export async function getUserDocument(
  id: string,
  userId: string
): Promise<ApplicationDocument | null> {
  const result = await db
    .select()
    .from(applicationDocuments)
    .where(and(eq(applicationDocuments.id, id), eq(applicationDocuments.userId, userId)))
    .limit(1);

  return result[0] || null;
}

/**
 * Create a new document
 */
export async function createDocument(
  data: NewApplicationDocument
): Promise<ApplicationDocument> {
  const result = await db
    .insert(applicationDocuments)
    .values(data)
    .returning();

  return result[0];
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(applicationDocuments)
    .where(and(eq(applicationDocuments.id, id), eq(applicationDocuments.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Delete all documents for an application
 */
export async function deleteApplicationDocuments(applicationId: string): Promise<number> {
  const result = await db
    .delete(applicationDocuments)
    .where(eq(applicationDocuments.applicationId, applicationId))
    .returning();

  return result.length;
}

