import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as projectQueries from "../queries/projects";

const projects = new Hono();

// Get all projects (public endpoint)
projects.get("/", async (c) => {
  try {
    const category = c.req.query("category");
    const status = c.req.query("status");
    const search = c.req.query("search");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
    const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

    const projectsList = await projectQueries.getAllProjects({
      category: category || undefined,
      status: status || undefined,
      search: search || undefined,
      limit,
      offset,
    });

    // Get total count for pagination
    const total = await projectQueries.getProjectsCount({
      category: category || undefined,
      status: status || undefined,
      search: search || undefined,
    });

    return c.json({
      data: projectsList,
      total,
      limit: limit || projectsList.length,
      offset: offset || 0,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get project by ID (public endpoint)
projects.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  try {
    const project = await projectQueries.getProjectById(id);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get project categories (public endpoint)
projects.get("/categories/list", async (c) => {
  try {
    const categories = await projectQueries.getProjectCategories();
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create project (requires admin - protected route)
const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(["new", "open", "closing-soon", "closed"]).default("open"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fundingAmount: z.string().min(1),
  location: z.string().min(1),
  imageUrl: z.string().url().optional(),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  applicationFee: z.number().optional(),
  maxApplicants: z.number().int().positive().optional(),
  currentApplicants: z.number().int().nonnegative().optional(),
});

projects.post(
  "/",
  zValidator("json", createProjectSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const project = await projectQueries.createProject({
        ...data,
        deadline: data.deadline,
        createdBy: userId,
      });

      return c.json(project, 201);
    } catch (error) {
      console.error("Error creating project:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Update project (requires admin - protected route)
const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.enum(["new", "open", "closing-soon", "closed"]).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fundingAmount: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  applicationFee: z.number().optional(),
  maxApplicants: z.number().int().positive().optional(),
  currentApplicants: z.number().int().nonnegative().optional(),
});

projects.patch(
  "/:id",
  zValidator("json", updateProjectSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json");

    if (isNaN(id)) {
      return c.json({ error: "Invalid project ID" }, 400);
    }

    const userId = c.get("userId");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const project = await projectQueries.updateProject(id, {
        ...data,
        deadline: data.deadline as any,
      });

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      return c.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Delete project (requires admin - protected route)
projects.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const deleted = await projectQueries.deleteProject(id);

    if (!deleted) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default projects;

