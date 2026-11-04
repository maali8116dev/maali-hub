/**
 * Loads .env.supabase then runs the Supabase CLI (keeps OAuth secrets out of root .env).
 */
import { spawnSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env.supabase") });

const args = process.argv.slice(2);
const result = spawnSync("supabase", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
