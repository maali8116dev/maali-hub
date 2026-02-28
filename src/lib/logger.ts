/**
 * Centralized logging utility
 * Strips console calls in production builds
 */

type LogLevel = "log" | "warn" | "error" | "info" | "debug";

interface LogContext {
  [key: string]: unknown;
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Logger utility that conditionally logs based on environment
 */
export const logger = {
  /**
   * Log informational messages (only in development)
   */
  log: (message: string, data?: LogContext | unknown) => {
    if (isDevelopment) {
      if (data) {
        console.log(`[LOG] ${message}`, data);
      } else {
        console.log(`[LOG] ${message}`);
      }
    }
  },

  /**
   * Log warning messages (always logged)
   */
  warn: (message: string, data?: LogContext | unknown) => {
    if (data) {
      console.warn(`[WARN] ${message}`, data);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  /**
   * Log error messages (always logged)
   */
  error: (message: string, error?: Error | LogContext | unknown) => {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error);
      // In production, you might want to send to error tracking service
      if (isProduction && typeof window !== "undefined" && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          extra: { message },
        });
      }
    } else if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  /**
   * Log info messages (only in development)
   */
  info: (message: string, data?: LogContext | unknown) => {
    if (isDevelopment) {
      if (data) {
        console.info(`[INFO] ${message}`, data);
      } else {
        console.info(`[INFO] ${message}`);
      }
    }
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (message: string, data?: LogContext | unknown) => {
    if (isDevelopment) {
      if (data) {
        console.debug(`[DEBUG] ${message}`, data);
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },

  /**
   * Group related logs together (only in development)
   */
  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  },

  /**
   * Log a table (only in development)
   */
  table: (data: unknown) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};

/**
 * Create a scoped logger with a prefix
 */
export function createScopedLogger(scope: string) {
  return {
    log: (message: string, data?: LogContext | unknown) =>
      logger.log(`[${scope}] ${message}`, data),
    warn: (message: string, data?: LogContext | unknown) =>
      logger.warn(`[${scope}] ${message}`, data),
    error: (message: string, error?: Error | LogContext | unknown) =>
      logger.error(`[${scope}] ${message}`, error),
    info: (message: string, data?: LogContext | unknown) =>
      logger.info(`[${scope}] ${message}`, data),
    debug: (message: string, data?: LogContext | unknown) =>
      logger.debug(`[${scope}] ${message}`, data),
  };
}

