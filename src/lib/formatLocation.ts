const capitalizeToken = (token: string): string => {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
};

const capitalizeSegment = (segment: string): string =>
  segment
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("-").map(capitalizeToken).join("-"))
    .join(" ");

/** Title-case location labels for display (e.g. "all africa" → "All Africa"). */
export function formatDisplayLocation(location: string): string {
  if (!location?.trim()) return location;
  return location
    .split(",")
    .map((part) => capitalizeSegment(part))
    .join(", ");
}
