import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { authMiddleware } from "./middleware/auth";
import profileRoutes from "./routes/profiles";
import applicationRoutes from "./routes/applications";
import documentRoutes from "./routes/documents";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
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

// API routes
app.route("/api/profiles", profileRoutes);
app.route("/api/applications", applicationRoutes);
app.route("/api/documents", documentRoutes);

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

