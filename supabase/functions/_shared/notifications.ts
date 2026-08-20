/** Merge i18n template metadata into notification RPC payloads. */

export function buildNotificationMetadata(
  template: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const cleanParams: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" || typeof value === "number") {
      cleanParams[key] = value;
    }
  }

  return {
    template,
    params: cleanParams,
    ...extra,
  };
}
