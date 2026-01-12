import { eq, and, or, like, desc } from "drizzle-orm";
import { db } from "../db";
import { projects, type Project, type NewProject } from "../db/schema";

/**
 * Get all projects with optional filters
 */
export async function getAllProjects(filters?: {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Project[]> {
  let query = db.select().from(projects);

  const conditions = [];

  if (filters?.category) {
    conditions.push(eq(projects.category, filters.category));
  }

  if (filters?.status) {
    conditions.push(eq(projects.status, filters.status));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(projects.title, searchTerm),
        like(projects.description, searchTerm),
        like(projects.location, searchTerm),
        like(projects.category, searchTerm),
        like(projects.fundingAmount, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(projects.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return await query;
}

/**
 * Get a project by ID
 */
export async function getProjectById(id: number): Promise<Project | null> {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Get total count of projects (for pagination)
 */
export async function getProjectsCount(filters?: {
  category?: string;
  status?: string;
  search?: string;
}): Promise<number> {
  let query = db.select().from(projects);

  const conditions = [];

  if (filters?.category) {
    conditions.push(eq(projects.category, filters.category));
  }

  if (filters?.status) {
    conditions.push(eq(projects.status, filters.status));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(projects.title, searchTerm),
        like(projects.description, searchTerm),
        like(projects.location, searchTerm),
        like(projects.category, searchTerm),
        like(projects.fundingAmount, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;
  return results.length;
}

/**
 * Get unique categories from all projects
 */
export async function getProjectCategories(): Promise<string[]> {
  const results = await db
    .selectDistinct({ category: projects.category })
    .from(projects);

  return results.map((r) => r.category).filter(Boolean) as string[];
}

/**
 * Create a new project
 */
export async function createProject(data: NewProject): Promise<Project> {
  const result = await db.insert(projects).values(data).returning();
  return result[0];
}

/**
 * Update a project
 */
export async function updateProject(
  id: number,
  data: Partial<NewProject>
): Promise<Project | null> {
  const result = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, id))
    .returning();

  return result[0] || null;
}

/**
 * Delete a project
 */
export async function deleteProject(id: number): Promise<boolean> {
  const result = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();

  return result.length > 0;
}

