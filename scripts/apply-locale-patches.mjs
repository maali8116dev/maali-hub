import {
  applyAtPath,
  applyRootPatch,
  LOCALE_NAMESPACES,
  readLocaleFile,
  readPatchFile,
  writeLocaleFile,
} from "./i18n-locale-utils.mjs";
import { LOCALE_PATCHES } from "./locale-patches.mjs";

const localeFilter = process.argv.includes("--locale")
  ? process.argv[process.argv.indexOf("--locale") + 1]
  : null;

let applied = 0;

for (const patch of LOCALE_PATCHES) {
  for (const locale of patch.locales) {
    if (localeFilter && locale !== localeFilter) continue;
    if (!LOCALE_NAMESPACES.includes(patch.namespace)) {
      throw new Error(`Unknown namespace: ${patch.namespace}`);
    }

    const filename =
      typeof patch.file === "function" ? patch.file(locale) : patch.file;
    const data = readPatchFile(filename);
    const localeData = readLocaleFile(locale, patch.namespace);

    if (patch.path) {
      applyAtPath(localeData, patch.path, data);
      console.log(`Patched ${locale}/${patch.namespace}.json → ${patch.path}`);
    } else {
      applyRootPatch(localeData, data);
      console.log(`Patched ${locale}/${patch.namespace}.json (multi-section)`);
    }
    writeLocaleFile(locale, patch.namespace, localeData);
    applied++;
  }
}

console.log(`\n${applied} patch(es) applied.`);
