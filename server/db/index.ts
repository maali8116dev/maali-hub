import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Get database connection string from environment variables
// For Supabase, you'll need the connection pooler URL or direct connection URL
// Format: postgresql://postgres:[password]@[host]:[port]/postgres
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create the connection
const client = postgres(connectionString, {
  max: 1, // Connection pool size
});

// Create the Drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in queries
export * from "./schema";

