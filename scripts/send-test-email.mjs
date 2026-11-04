import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return [key, value];
    }),
);

const to = process.argv[2] || "paystack.test.20260624@gmail.com";
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env");
  process.exit(1);
}

const body = {
  type: "contact_confirmation",
  allowPublic: true,
  to: "",
  data: {
    email: to,
    firstName: "Test",
    message: "Email logo test — confirm header logo renders.",
    submissionId: `logo-test-${Date.now()}`,
  },
};

const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(JSON.stringify({ status: res.status, body: text }, null, 2));
process.exit(res.ok ? 0 : 1);
