import type { TFunction } from "i18next";
import type { Notification } from "@/hooks/useNotifications";

export type NotificationMetadata = Notification["metadata"] & {
  template?: string;
  params?: Record<string, unknown>;
};

function normalizeParams(
  params: Record<string, unknown> | undefined,
  t: TFunction,
): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === "string" || typeof value === "number") {
      normalized[key] = value;
    }
  }

  if (!normalized.opportunityTitle) {
    normalized.opportunityTitle = t("notifications.messages.fallbackOpportunity");
  }

  return normalized;
}

export function resolveNotificationText(
  notification: Pick<Notification, "title" | "message" | "metadata">,
  t: TFunction,
): { title: string; message: string } {
  const metadata = notification.metadata as NotificationMetadata | undefined;
  const template = metadata?.template;

  if (!template) {
    return { title: notification.title, message: notification.message };
  }

  const baseKey = `notifications.messages.${template}`;
  const params = normalizeParams(metadata?.params, t);

  return {
    title: t(`${baseKey}.title`, {
      ...params,
      defaultValue: notification.title,
    }),
    message: t(`${baseKey}.message`, {
      ...params,
      defaultValue: notification.message,
    }),
  };
}
