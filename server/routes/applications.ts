import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as applicationQueries from "../queries/applications";

const applications = new Hono();

// Get all applications for current user
applications.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const userApplications = await applicationQueries.getUserApplications(userId);
    return c.json(userApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get application by ID
applications.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const application = await applicationQueries.getUserApplication(id, userId);
    
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }

    return c.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get applications by project ID (public endpoint, but filtered)
applications.get("/project/:projectId", async (c) => {
  const projectId = parseInt(c.req.param("projectId"));
  const userId = c.get("userId");

  if (isNaN(projectId)) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  try {
    const projectApplications = await applicationQueries.getApplicationsByProjectId(projectId);
    
    // If user is authenticated, return their applications; otherwise return count only
    if (userId) {
      const userApps = projectApplications.filter(app => app.userId === userId);
      return c.json({
        total: projectApplications.length,
        userApplications: userApps,
      });
    }

    return c.json({
      total: projectApplications.length,
    });
  } catch (error) {
    console.error("Error fetching project applications:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create application
const createApplicationSchema = z.object({
  projectId: z.number().int().positive(),
  companyName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  projectDescription: z.string().min(1),
  fundingAmountRequested: z.string().min(1),
  businessPlan: z.string().optional(),
  teamSize: z.number().int().positive().optional(),
  location: z.string().optional(),
});

applications.post(
  "/",
  zValidator("json", createApplicationSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const application = await applicationQueries.createApplication({
        ...data,
        userId,
        status: "pending",
        applicationFeePaid: false,
      });

      return c.json(application, 201);
    } catch (error) {
      console.error("Error creating application:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Update application
const updateApplicationSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  projectDescription: z.string().min(1).optional(),
  fundingAmountRequested: z.string().min(1).optional(),
  businessPlan: z.string().optional(),
  teamSize: z.number().int().positive().optional(),
  location: z.string().optional(),
  status: z.enum(["pending", "under_review", "approved", "rejected"]).optional(),
});

applications.patch(
  "/:id",
  zValidator("json", updateApplicationSchema),
  async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");
    const data = c.req.valid("json");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const application = await applicationQueries.updateApplication(id, userId, data);
      
      if (!application) {
        return c.json({ error: "Application not found" }, 404);
      }

      return c.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Delete application
applications.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const deleted = await applicationQueries.deleteApplication(id, userId);
    
    if (!deleted) {
      return c.json({ error: "Application not found" }, 404);
    }

    return c.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default applications;

