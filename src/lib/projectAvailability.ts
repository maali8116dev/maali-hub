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

  // Only projects explicitly marked as "open" and not past deadline
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
): "Open for applications" | "Closed for applications" {
  return isProjectOpen(status, deadline)
    ? "Open for applications"
    : "Closed for applications";
}

export type ProjectDisplayStatus =
  | "New"
  | "Closing Soon"
  | "Open"
  | "Closed"
  | "Archived";

export function getProjectDisplayStatus(
  status?: string | null,
  deadline?: string | null,
  createdAt?: string | null,
): ProjectDisplayStatus {
  if (!status) return "Closed";

  // Archived always shows as Archived
  if (status === "archived") {
    return "Archived";
  }

  const now = new Date();

  // If not open for applications, show Closed
  if (!isProjectOpen(status, deadline)) {
    return "Closed";
  }

  // At this point project is open for applications; derive "New" / "Closing Soon" / "Open"
  const NEW_DAYS = 7;
  const CLOSING_SOON_DAYS = 7;

  // New: created within last NEW_DAYS days
  if (createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      const diffMs = now.getTime() - created.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= NEW_DAYS) {
        return "New";
      }
    }
  }

  // Closing Soon: deadline within next CLOSING_SOON_DAYS days
  const deadlineDate = parseDateFromYYYYMMDD(deadline);
  if (deadlineDate) {
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= CLOSING_SOON_DAYS) {
      return "Closing Soon";
    }
  }

  // Otherwise, it's just Open
  return "Open";
}









