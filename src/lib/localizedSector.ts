import type { TFunction } from "i18next";

/** Sector names from DB map to applications.form.options.sectors.* locale keys. */
export function getLocalizedSectorName(name: string, t: TFunction): string {
  return t(`applications.form.options.sectors.${name}`, {
    ns: "dashboard",
    defaultValue: name,
  });
}
