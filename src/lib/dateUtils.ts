import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";

export type DateFormat = "short" | "long" | "relative" | "datetime" | "time";

/**
 * Format a date string or Date object
 * @param date - Date string or Date object
 * @param formatType - Format type: 'short' (MMM d, yyyy), 'long' (MMMM d, yyyy), 'relative' (2 days ago), 'datetime' (MMM d, yyyy h:mm a), 'time' (h:mm a)
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatType: DateFormat = "short"
): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    switch (formatType) {
      case "short":
        return format(dateObj, "MMM d, yyyy");
      case "long":
        return format(dateObj, "MMMM d, yyyy");
      case "relative":
        return formatDistanceToNow(dateObj, { addSuffix: true });
      case "datetime":
        return format(dateObj, "MMM d, yyyy h:mm a");
      case "time":
        return format(dateObj, "h:mm a");
      default:
        return format(dateObj, "MMM d, yyyy");
    }
  } catch (error) {
    return "";
  }
}

/**
 * Format a date with smart relative formatting (today, yesterday, or relative)
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDateSmart(date: string | Date | null | undefined): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    if (isToday(dateObj)) {
      return `Today, ${format(dateObj, "h:mm a")}`;
    }

    if (isYesterday(dateObj)) {
      return `Yesterday, ${format(dateObj, "h:mm a")}`;
    }

    // If within last 7 days, show relative
    const daysDiff = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return formatDistanceToNow(dateObj, { addSuffix: true });
    }

    // Otherwise show short date
    return format(dateObj, "MMM d, yyyy");
  } catch (error) {
    return "";
  }
}

/**
 * Format a date time string
 * @param date - Date string or Date object
 * @returns Formatted date time string
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, "datetime");
}

/**
 * Get relative time (e.g., "2 hours ago")
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date | null | undefined): string {
  return formatDate(date, "relative");
}

/**
 * Format date using browser's locale
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateLocale(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    return dateObj.toLocaleDateString(undefined, options);
  } catch (error) {
    return "";
  }
}









