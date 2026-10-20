import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
  default: {
    t: (key: string) => {
      if (key === "applicationWindow.closed") return "Closed for applications";
      if (key === "applicationWindow.open") return "Open for applications";
      return key;
    },
  },
}));

import { getProjectApplicationStateLabel, isProjectOpen } from "@/lib/projectAvailability";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("projectAvailability", () => {
  it("returns true for open status with a future deadline", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    expect(isProjectOpen("open", formatDate(future))).toBe(true);
  });

  it("returns true for open status with today's date", () => {
    const today = new Date();
    expect(isProjectOpen("open", formatDate(today))).toBe(true);
  });

  it("returns false for closed status even with future deadline", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(isProjectOpen("closed", formatDate(future))).toBe(false);
  });

  it("returns false for open status with a past deadline", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isProjectOpen("open", formatDate(past))).toBe(false);
  });

  it("returns a consistent label from status/deadline", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(getProjectApplicationStateLabel("open", formatDate(past))).toBe("Closed for applications");
  });
});









