import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src", "assets", "favicon_io");
const dest = path.join(root, "public");

for (const name of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}

const heroSrc = path.join(root, "src", "assets", "hero-agriculture.webp");
const heroDestDir = path.join(root, "public", "images");
const heroDest = path.join(heroDestDir, "hero-agriculture.webp");
if (fs.existsSync(heroSrc)) {
  fs.mkdirSync(heroDestDir, { recursive: true });
  fs.copyFileSync(heroSrc, heroDest);
}

const logoSrc = path.join(root, "src", "assets", "logo.webp");
const logoDest = path.join(heroDestDir, "logo.webp");
if (fs.existsSync(logoSrc)) {
  fs.mkdirSync(heroDestDir, { recursive: true });
  fs.copyFileSync(logoSrc, logoDest);
}
