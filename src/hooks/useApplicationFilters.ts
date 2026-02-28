import { useState, useMemo } from "react";

/**
 * Generic application type that has at least a status property
 */
type ApplicationWithStatus = {
  status: string;
  [key: string]: unknown;
};

interface UseApplicationFiltersOptions<T extends ApplicationWithStatus> {
  /**
   * Array of applications to filter
   */
  applications: T[];
  
  /**
   * Default status filter value
   * @default "all"
   */
  defaultFilter?: string;
  
  /**
   * Custom status values to include in counts (if not provided, auto-detects from applications)
   */
  statusValues?: string[];
  
  /**
   * Custom filter function (optional, defaults to status matching)
   */
  customFilter?: (app: T, statusFilter: string) => boolean;
}

interface UseApplicationFiltersReturn<T extends ApplicationWithStatus> {
  /**
   * Filtered applications based on current status filter
   */
  filteredApplications: T[];
  
  /**
   * Count of applications per status
   */
  statusCounts: Record<string, number>;
  
  /**
   * Current status filter value
   */
  statusFilter: string;
  
  /**
   * Function to update status filter
   */
  setStatusFilter: (filter: string) => void;
}

/**
 * Hook for filtering applications by status
 * 
 * @example
 * ```tsx
 * const { filteredApplications, statusCounts, statusFilter, setStatusFilter } = 
 *   useApplicationFilters({ applications });
 * ```
 */
export function useApplicationFilters<T extends ApplicationWithStatus>({
  applications,
  defaultFilter = "all",
  statusValues,
  customFilter,
}: UseApplicationFiltersOptions<T>): UseApplicationFiltersReturn<T> {
  const [statusFilter, setStatusFilter] = useState<string>(defaultFilter);

  // Auto-detect status values from applications if not provided
  const detectedStatusValues = useMemo(() => {
    if (statusValues) return statusValues;
    
    const uniqueStatuses = new Set<string>();
    applications.forEach((app) => {
      if (app.status) {
        uniqueStatuses.add(app.status);
      }
    });
    return Array.from(uniqueStatuses);
  }, [applications, statusValues]);

  // Filter applications based on status
  const filteredApplications = useMemo(() => {
    if (statusFilter === "all") {
      return applications;
    }

    if (customFilter) {
      return applications.filter((app) => customFilter(app, statusFilter));
    }

    return applications.filter((app) => app.status === statusFilter);
  }, [applications, statusFilter, customFilter]);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: applications.length,
    };

    detectedStatusValues.forEach((status) => {
      counts[status] = applications.filter((app) => app.status === status).length;
    });

    return counts;
  }, [applications, detectedStatusValues]);

  return {
    filteredApplications,
    statusCounts,
    statusFilter,
    setStatusFilter,
  };
}

