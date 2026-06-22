/**
 * Sync static locale JSON from en -> target locale.
 * Copies missing keys only (English placeholders for manual translation).
 * No machine translation — GOOGLE_CLOUD_TRANSLATE_API_KEY is for dynamic DB content only.
 *
 * Usage: npm run i18n:translate-de
 *        node scripts/translate-static-locale.mjs --locale fr
 */
import {
  LOCALE_NAMESPACES,
  countAddedKeys,
  mergeMissingKeys,
  parseArgs,
  readLocaleFile,
  writeLocaleFile,
} from "./i18n-locale-utils.mjs";

const { locale } = parseArgs(process.argv.slice(2));

let totalAdded = 0;

for (const namespace of LOCALE_NAMESPACES) {
  const en = readLocaleFile("en", namespace);
  const before = readLocaleFile(locale, namespace);
  const merged = mergeMissingKeys(en, before);
  const added = countAddedKeys(before, merged);

  if (added.length) {
    writeLocaleFile(locale, namespace, merged);
  }

  totalAdded += added.length;
  console.log(`${namespace}: +${added.length} key(s)`);
  if (added.length) {
    console.log(added.join("\n"));
  }
}

console.log(`\n${locale}: ${totalAdded} new key(s) copied from en (translate manually).`);
