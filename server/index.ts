import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { authMiddleware } from "./middleware/auth";
import profileRoutes from "./routes/profiles";
import applicationRoutes from "./routes/applications";
import documentRoutes from "./routes/documents";
import projectRoutes from "./routes/projects";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: (origin) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return process.env.FRONTEND_URL || "http://localhost:8080";
    }
    // In development, allow any localhost origin
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return origin;
    }
    // For production, use the configured frontend URL
    const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
    if (origin === allowedOrigin) {
      return origin;
    }
    // Default deny
    return allowedOrigin;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposeHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400,
}));
app.use("/api/*", prettyJSON());

// Health check
app.get("/", (c) => {
  return c.json({ message: "Maali API Server", status: "ok" });
});

// Public routes
app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Protected routes (require authentication)
app.use("/api/profiles/*", authMiddleware);
app.use("/api/applications/*", authMiddleware);
app.use("/api/documents/*", authMiddleware);
// Projects: GET routes are public, POST/PATCH/DELETE require auth (handled in route)
app.use("/api/projects", async (c, next) => {
  // Only apply auth middleware to non-GET routes
  if (c.req.method !== "GET") {
    return authMiddleware(c, next);
  }
  return next();
});

// API routes
app.route("/api/profiles", profileRoutes);
app.route("/api/applications", applicationRoutes);
app.route("/api/documents", documentRoutes);
app.route("/api/projects", projectRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

export default app;

