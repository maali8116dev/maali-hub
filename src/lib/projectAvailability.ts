import type { TFunction } from "i18next";
import i18n from "@/lib/i18n";

type CommonT = TFunction<readonly ["common"], undefined>;

function resolveT(t?: TFunction): CommonT {
  if (t) {
    return ((key: string, options?: Record<string, unknown>) =>
      t(key, { ns: "common", ...options })) as CommonT;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: "common", ...options })) as CommonT;
}

function parseDateFromYYYYMMDD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

export function isProjectOpen(status?: string | null, deadline?: string | null): boolean {
  if (!status) return false;

  if (status !== "open") return false;

  if (!deadline) return true;

  const date = parseDateFromYYYYMMDD(deadline);
  if (!date) return false;

  const deadlineEndOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
  return new Date() <= deadlineEndOfDay;
}

export function getProjectApplicationStateLabel(
  status?: string | null,
  deadline?: string | null,
  t?: TFunction,
): string {
  const tr = resolveT(t);
  return isProjectOpen(status, deadline)
    ? tr("applicationWindow.open")
    : tr("applicationWindow.closed");
}

export type ProjectDisplayStatusKey = "new" | "closingSoon" | "open" | "closed" | "archived";

export function getProjectDisplayStatusKey(
  status?: string | null,
  deadline?: string | null,
  createdAt?: string | null,
): ProjectDisplayStatusKey {
  if (!status) return "closed";

  if (status === "archived") {
    return "archived";
  }

  if (!isProjectOpen(status, deadline)) {
    return "closed";
  }

  const now = new Date();
  const NEW_DAYS = 7;
  const CLOSING_SOON_DAYS = 7;

  if (createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      const diffMs = now.getTime() - created.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= NEW_DAYS) {
        return "new";
      }
    }
  }

  const deadlineDate = parseDateFromYYYYMMDD(deadline);
  if (deadlineDate) {
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= CLOSING_SOON_DAYS) {
      return "closingSoon";
    }
  }

  return "open";
}

export function getProjectDisplayStatus(
  status?: string | null,
  deadline?: string | null,
  createdAt?: string | null,
  t?: TFunction,
): string {
  const tr = resolveT(t);
  const key = getProjectDisplayStatusKey(status, deadline, createdAt);
  const statusMap: Record<ProjectDisplayStatusKey, string> = {
    new: tr("status.opportunity.new"),
    closingSoon: tr("status.opportunity.closingSoon"),
    open: tr("status.opportunity.open"),
    closed: tr("status.opportunity.closed"),
    archived: tr("status.opportunity.archived"),
  };
  return statusMap[key];
}
