/**
 * API client for backend communication
 * Handles authentication and API calls
 */

import { supabase } from "@/integrations/supabase/client";

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
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.message || error.error || "API request failed");
  }

  return response.json();
}

/**
 * API client methods
 */
export const api = {
  // Profiles
  profiles: {
    getMe: () => apiRequest<{ id: string; userId: string; firstName: string | null }>("/api/profiles/me"),
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
};

export default api;

