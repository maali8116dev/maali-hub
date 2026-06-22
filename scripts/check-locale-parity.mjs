import {
  LOCALE_NAMESPACES,
  SUPPORTED_LOCALES,
  getLeafKeys,
  getLeafValue,
  parseArgs,
  readLocaleFile,
} from "./i18n-locale-utils.mjs";

function checkLocale(locale) {
  let totalMissing = 0;
  let totalSameAsEn = 0;

  for (const namespace of LOCALE_NAMESPACES) {
    const en = readLocaleFile("en", namespace);
    const target = readLocaleFile(locale, namespace);
    const enKeys = getLeafKeys(en);
    const targetKeys = getLeafKeys(target);
    const missing = enKeys.filter((key) => !targetKeys.includes(key));
    const sameAsEn = enKeys.filter((key) => {
      const enValue = getLeafValue(en, key);
      const targetValue = getLeafValue(target, key);
      return enValue === targetValue && typeof enValue === "string" && enValue.length > 1;
    });

    totalMissing += missing.length;
    totalSameAsEn += sameAsEn.length;

    console.log(`\n=== ${locale}/${namespace} ===`);
    console.log(`EN: ${enKeys.length}  ${locale}: ${targetKeys.length}`);
    console.log(`Missing: ${missing.length}`);
    if (missing.length) console.log(missing.join("\n"));
    console.log(`Same as EN: ${sameAsEn.length}`);
  }

  console.log(`\n${locale} TOTAL missing: ${totalMissing}, same as EN: ${totalSameAsEn}`);
  return totalMissing;
}

const localeArg = process.argv.indexOf("--locale");
const locales =
  localeArg >= 0
    ? [parseArgs(process.argv.slice(2)).locale]
    : SUPPORTED_LOCALES;

let failed = 0;
for (const locale of locales) {
  failed += checkLocale(locale);
}

process.exit(failed > 0 ? 1 : 0);
