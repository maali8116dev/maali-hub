/**
 * Translate same-as-EN locale strings via Google Cloud Translation API.
 * Skips proper nouns, placeholders, and brand names.
 *
 * Usage: GOOGLE_CLOUD_TRANSLATE_API_KEY=... node scripts/translate-same-as-en.mjs
 *        node scripts/translate-same-as-en.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import {
  LOCALE_NAMESPACES,
  SUPPORTED_LOCALES,
  applyRootPatch,
  getLeafKeys,
  getLeafValue,
  readLocaleFile,
  setLeafValue,
  writeLocaleFile,
} from "./i18n-locale-utils.mjs";

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const BATCH = 50;

const SKIP_KEY_RE =
  /(?:brandAlt|logoAlt|Placeholder|country(?:Nigeria|Kenya|SouthAfrica|Ghana|Uganda|Tanzania)|testimonial\d+\.(?:name|company|location|sector)|titleHighlight|copyright|scoreOutOf|yearEstablished|teamMembers|linkedin|github|twitter|website|price|businessName)/i;

const SKIP_VALUE_RE =
  /^(Maali|Blog|FAQ|Fintech|LinkedIn:|GitHub:|Twitter\/X:|Website:|\$2|Amara|Diallo|Savanna Ventures|Ahmed Hassan|Kofi Mensah|Amina Okafor|FinTech Solutions|AgriTech Innovations|EdTech Platform|Community|Full Member|Nigeria|Kenya|Ghana|Uganda|Tanzania|South Africa|\d{4}|\+\d|10|©)/;

async function translateTexts(texts, targetLanguage) {
  const apiKey = process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_CLOUD_TRANSLATE_API_KEY required");

  const url = new URL(TRANSLATE_URL);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, target: targetLanguage, source: "en", format: "text" }),
  });

  if (!response.ok) {
    throw new Error(`Translation API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json();
  return payload?.data?.translations?.map((r) => r.translatedText) ?? [];
}

function collectSameAsEn(locale) {
  const entries = [];
  for (const namespace of LOCALE_NAMESPACES) {
    const en = readLocaleFile("en", namespace);
    const target = readLocaleFile(locale, namespace);
    for (const key of getLeafKeys(en)) {
      const enValue = getLeafValue(en, key);
      const targetValue = getLeafValue(target, key);
      if (typeof enValue !== "string" || enValue.length <= 1) continue;
      if (enValue !== targetValue) continue;
      if (SKIP_KEY_RE.test(key) || SKIP_VALUE_RE.test(enValue.trim())) continue;
      entries.push({ namespace, key, value: enValue });
    }
  }
  return entries;
}

const dryRun = process.argv.includes("--dry-run");

for (const locale of SUPPORTED_LOCALES) {
  const entries = collectSameAsEn(locale);
  console.log(`\n${locale}: ${entries.length} string(s) to translate`);
  if (!entries.length) continue;

  if (dryRun) {
    entries.slice(0, 15).forEach((e) => console.log(`  ${e.namespace}.${e.key}`));
    if (entries.length > 15) console.log(`  ... +${entries.length - 15} more`);
    continue;
  }

  const byNs = {};
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const translated = await translateTexts(
      batch.map((e) => e.value),
      locale,
    );
    batch.forEach((entry, idx) => {
      if (!byNs[entry.namespace]) byNs[entry.namespace] = structuredClone(readLocaleFile(locale, entry.namespace));
      setLeafValue(byNs[entry.namespace], entry.key, translated[idx] ?? entry.value);
    });
  }

  for (const [namespace, data] of Object.entries(byNs)) {
    writeLocaleFile(locale, namespace, data);
    console.log(`  wrote ${namespace}.json`);
  }
}

console.log("\nDone.");
