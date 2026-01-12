// Load environment variables FIRST, before any other imports
import "dotenv/config";

import { serve } from "@hono/node-server";
import app from "./index";

// Get port from environment or default to 3000
const port = parseInt(process.env.PORT || "3000", 10);

// Start server
serve({
  fetch: app.fetch,
  port,
}, (info: { port: number; address: string }) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`);
});

