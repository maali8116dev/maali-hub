/**
 * Maintenance mode configuration
 * 
 * To enable maintenance mode, set VITE_MAINTENANCE_MODE=true in your .env file
 * You can also customize the message, estimated time, and contact email via environment variables
 */

export interface MaintenanceConfig {
  enabled: boolean;
  message?: string;
  estimatedTime?: string;
  contactEmail?: string;
}

/**
 * Get maintenance mode configuration from environment variables
 */
export function getMaintenanceConfig(): MaintenanceConfig {
  const enabled = import.meta.env.VITE_MAINTENANCE_MODE === "true";
  
  return {
    enabled,
    message: import.meta.env.VITE_MAINTENANCE_MESSAGE,
    estimatedTime: import.meta.env.VITE_MAINTENANCE_ESTIMATED_TIME,
    contactEmail: import.meta.env.VITE_MAINTENANCE_CONTACT_EMAIL,
  };
}

/**
 * Check if maintenance mode is currently enabled
 */
export function isMaintenanceModeEnabled(): boolean {
  return getMaintenanceConfig().enabled;
}

