/**
 * Data Source Configuration
 * 
 * Toggle this to switch between direct Supabase queries and backend API.
 * Set to 'direct' for direct Supabase connection (recommended for now)
 * Set to 'api' to use the Hono backend API
 */

export type DataSource = 'direct' | 'api';

// ========================================
// CHANGE THIS VALUE TO SWITCH DATA SOURCE
// ========================================
const currentDataSource: DataSource = 'direct';

// Export as a function to avoid TypeScript narrowing issues
export const DATA_SOURCE = (): DataSource => currentDataSource;

// Helper to check current mode
export const isDirectMode = (): boolean => DATA_SOURCE() === 'direct';
export const isApiMode = (): boolean => DATA_SOURCE() === 'api';
