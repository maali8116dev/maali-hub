/**
 * API client for backend communication
 * Handles authentication and API calls
 */

import { supabase } from "@/integrations/supabase/client";
import { captureError, addBreadcrumb } from "@/lib/sentry";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Get authentication headers with Supabase JWT token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Make an API request (auth optional for public endpoints)
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = true
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Only add auth headers if required or if available
  if (requireAuth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  } else {
    // For public endpoints, try to add auth if available (optional)
    try {
      const authHeaders = await getAuthHeaders();
      if (authHeaders["Authorization"]) {
        headers["Authorization"] = authHeaders["Authorization"];
      }
    } catch {
      // Ignore auth errors for public endpoints
    }
  }
  
  // Add breadcrumb for request tracking
  addBreadcrumb(`API ${options.method || "GET"} ${endpoint}`, "api", {
    endpoint,
    method: options.method || "GET",
  });

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    const error = new Error(errorData.message || errorData.error || "API request failed");
    
    // Capture error to Sentry with context
    captureError(error, {
      endpoint,
      method: options.method || "GET",
      status: response.status,
      statusText: response.statusText,
      errorData,
    });
    
    throw error;
  }

  return response.json();
}

/**
 * API client methods
 */
export const api = {
  // Profiles
  profiles: {
    getMe: () => apiRequest<{
      id: string;
      userId: string;
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
      businesssector: string | null;
      country: string | null;
      bio: string | null;
      avatarUrl: string | null;
      role: "admin" | "reviewer" | "applicant";
      createdAt: string;
      updatedAt: string;
    }>("/api/profiles/me"),
    getById: (id: string) => apiRequest(`/api/profiles/${id}`),
    create: (data: any) => apiRequest("/api/profiles", { method: "POST", body: JSON.stringify(data) }),
    update: (data: any) => apiRequest("/api/profiles/me", { method: "PATCH", body: JSON.stringify(data) }),
    delete: () => apiRequest("/api/profiles/me", { method: "DELETE" }),
  },

  // Applications
  applications: {
    getAll: () => apiRequest("/api/applications"),
    getById: (id: string) => apiRequest(`/api/applications/${id}`),
    getByProjectId: (projectId: number) => apiRequest(`/api/applications/project/${projectId}`),
    create: (data: any) => apiRequest("/api/applications", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest(`/api/applications/${id}`, { method: "DELETE" }),
  },

  // Documents
  documents: {
    getAll: () => apiRequest("/api/documents"),
    getById: (id: string) => apiRequest(`/api/documents/${id}`),
    getByApplicationId: (applicationId: string) => apiRequest(`/api/documents/application/${applicationId}`),
    create: (data: any) => apiRequest("/api/documents", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest(`/api/documents/${id}`, { method: "DELETE" }),
  },

  // Projects (public GET endpoints, auth required for POST/PATCH/DELETE)
  projects: {
    getAll: (params?: { sector?: string; status?: string; search?: string; limit?: number; offset?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.sector) queryParams.append("sector", params.sector);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.search) queryParams.append("search", params.search);
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());
      const query = queryParams.toString();
      return apiRequest<{ data: any[]; total: number; limit: number; offset: number }>(
        `/api/projects${query ? `?${query}` : ""}`,
        {},
        false // Public endpoint
      );
    },
    getById: (id: number) => apiRequest(`/api/projects/${id}`, {}, false), // Public endpoint
    getSectors: () => apiRequest<string[]>("/api/projects/sectors/list", {}, false), // Public endpoint
    create: (data: any) => apiRequest("/api/projects", { method: "POST", body: JSON.stringify(data) }, true),
    update: (id: number, data: any) => apiRequest(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }, true),
    delete: (id: number) => apiRequest(`/api/projects/${id}`, { method: "DELETE" }, true),
  },
};

export default api;









