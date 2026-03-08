/**
 * Check if an opportunity is open for applications
 */
export function isOpportunityOpen(
  status: string | undefined,
  deadline: string | undefined
): boolean {
  if (!status || !deadline) return false;
  
  if (status !== "open") return false;
  
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return deadlineDate >= today;
}

