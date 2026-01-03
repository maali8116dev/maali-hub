import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as profileQueries from "../queries/profiles";

const profiles = new Hono();

// Get current user's profile
profiles.get("/me", async (c) => {
  const userId = c.get("userId");
  
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await profileQueries.getProfileByUserId(userId);
    
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get profile by ID
profiles.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const profile = await profileQueries.getProfileById(id);
    
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create profile
const createProfileSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  businessName: z.string().optional(),
  businessSector: z.string().optional(),
  country: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

profiles.post(
  "/",
  zValidator("json", createProfileSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");

    // Ensure user can only create their own profile
    if (data.userId !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const profile = await profileQueries.createProfile(data);
      return c.json(profile, 201);
    } catch (error) {
      console.error("Error creating profile:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Update profile
const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  businessName: z.string().optional(),
  businessSector: z.string().optional(),
  country: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

profiles.patch(
  "/me",
  zValidator("json", updateProfileSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const profile = await profileQueries.updateProfile(userId, data);
      
      if (!profile) {
        return c.json({ error: "Profile not found" }, 404);
      }

      return c.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Delete profile
profiles.delete("/me", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const deleted = await profileQueries.deleteProfile(userId);
    
    if (!deleted) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default profiles;

