import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(__dirname, "..");
export const localesDir = path.join(root, "src/locales");

export const LOCALE_NAMESPACES = [
  "common",
  "navigation",
  "landing",
  "footer",
  "dashboard",
];

export const SUPPORTED_LOCALES = ["fr", "pt", "de"];

export function parseArgs(argv) {
  const localeIdx = argv.indexOf("--locale");
  const locale = localeIdx >= 0 ? argv[localeIdx + 1] : null;
  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    throw new Error(
      `Usage: --locale <${SUPPORTED_LOCALES.join("|")}>`,
    );
  }
  return { locale };
}

export function readLocaleFile(locale, namespace) {
  const filePath = path.join(localesDir, locale, `${namespace}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeLocaleFile(locale, namespace, data) {
  const filePath = path.join(localesDir, locale, `${namespace}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function getLeafKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value, pathKey));
    } else {
      keys.push(pathKey);
    }
  }
  return keys;
}

export function getLeafValue(obj, keyPath) {
  return keyPath.split(".").reduce((current, key) => current?.[key], obj);
}

export function setLeafValue(obj, keyPath, value) {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/** Deep-merge missing keys from source into target (target values win). */
export function mergeMissingKeys(source, target) {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return target ?? source;
  }

  const out = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    if (!(key in out)) {
      out[key] = structuredClone(sourceValue);
      continue;
    }
    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeMissingKeys(sourceValue, out[key]);
    }
  }
  return out;
}

export function countAddedKeys(before, after) {
  const beforeKeys = new Set(getLeafKeys(before));
  const afterKeys = getLeafKeys(after);
  return afterKeys.filter((key) => !beforeKeys.has(key));
}

/** Deep-merge patch into target; patch values win on conflicts. */
export function deepMerge(patch, target) {
  if (
    typeof patch !== "object" ||
    patch === null ||
    Array.isArray(patch) ||
    typeof target !== "object" ||
    target === null ||
    Array.isArray(target)
  ) {
    return structuredClone(patch);
  }

  const out = { ...target };
  for (const [key, patchValue] of Object.entries(patch)) {
    if (
      patchValue &&
      typeof patchValue === "object" &&
      !Array.isArray(patchValue) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(patchValue, out[key]);
    } else {
      out[key] = structuredClone(patchValue);
    }
  }
  return out;
}

/** Merge patch into obj at dot path (e.g. applications.form). */
export function applyAtPath(obj, keyPath, patch) {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  const leaf = parts[parts.length - 1];
  current[leaf] = deepMerge(patch, current[leaf] ?? {});
  return obj;
}

/** Merge each top-level key from patch into obj (multi-section dashboard patches). */
export function applyRootPatch(obj, patch) {
  for (const [key, value] of Object.entries(patch)) {
    applyAtPath(obj, key, value);
  }
  return obj;
}

export function readPatchFile(filename) {
  const filePath = path.join(__dirname, "locales", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
