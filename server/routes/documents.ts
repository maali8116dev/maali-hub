import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as documentQueries from "../queries/documents";

const documents = new Hono();

// Get all documents for an application
documents.get("/application/:applicationId", async (c) => {
  const applicationId = c.req.param("applicationId");
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const docs = await documentQueries.getApplicationDocuments(applicationId);
    
    // Filter to only return user's documents
    const userDocs = docs.filter(doc => doc.userId === userId);
    
    return c.json(userDocs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get all documents for current user
documents.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const docs = await documentQueries.getUserDocuments(userId);
    return c.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get document by ID
documents.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const doc = await documentQueries.getUserDocument(id, userId);
    
    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }

    return c.json(doc);
  } catch (error) {
    console.error("Error fetching document:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create document
const createDocumentSchema = z.object({
  applicationId: z.string().uuid().optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
  fileType: z.string().optional(),
});

documents.post(
  "/",
  zValidator("json", createDocumentSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const document = await documentQueries.createDocument({
        ...data,
        userId,
      });

      return c.json(document, 201);
    } catch (error) {
      console.error("Error creating document:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// Delete document
documents.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const deleted = await documentQueries.deleteDocument(id, userId);
    
    if (!deleted) {
      return c.json({ error: "Document not found" }, 404);
    }

    return c.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default documents;

