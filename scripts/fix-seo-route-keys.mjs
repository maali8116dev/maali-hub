import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "locales");
const replacements = [
  ['"/"', '"home"'],
  ['"/opportunities"', '"opportunities"'],
  ['"/about"', '"about"'],
  ['"/resources"', '"resources"'],
  ['"/contact"', '"contact"'],
  ['"/partners"', '"partners"'],
  ['"/success-stories"', '"successStories"'],
  ['"/blog"', '"blog"'],
  ['"/help"', '"help"'],
  ['"/faq"', '"faq"'],
  ['"/mentors"', '"mentors"'],
  ['"/guide"', '"guide"'],
  ['"/privacy"', '"privacy"'],
  ['"/terms"', '"terms"'],
  ['"/cookies"', '"cookies"'],
  ['"/auth"', '"auth"'],
];

for (const locale of ["pt", "de"]) {
  const filePath = path.join(dir, `landing-public-pages-${locale}.json`);
  let content = fs.readFileSync(filePath, "utf8");
  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to);
  }
  fs.writeFileSync(filePath, content);
}

console.log("Fixed pt/de SEO route keys");
