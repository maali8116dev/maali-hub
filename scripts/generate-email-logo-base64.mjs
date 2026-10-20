import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const png = path.join(root, "supabase/functions/_shared/assets/email-logo.png");
const out = path.join(root, "supabase/functions/_shared/emailLogoBase64.ts");

if (!fs.existsSync(png)) {
  console.error("Missing", png, "— run: npx sharp-cli -i src/assets/logo.webp -o", png, "resize 200");
  process.exit(1);
}

const b64 = fs.readFileSync(png).toString("base64");
fs.writeFileSync(
  out,
  `// Generated from assets/email-logo.png — run: node scripts/generate-email-logo-base64.mjs\nexport const EMAIL_LOGO_PNG_BASE64 = "${b64}";\n`,
);
console.log("Wrote", out, `(${b64.length} chars)`);
