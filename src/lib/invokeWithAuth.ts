import { supabase } from "@/integrations/supabase/client";
import type { FunctionInvokeOptions } from "@supabase/supabase-js";

/** Invoke an edge function with JWT in header + body (local relay may strip Authorization). */
export async function invokeWithAuth<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown> = {},
  options?: Omit<FunctionInvokeOptions, "body" | "headers">,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return {
      data: null,
      error: new Error("Your session has expired. Please sign in again."),
    };
  }

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    body: { ...body, token },
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function parseEdgeFunctionError(error: unknown): string | null {
  const rawBody = (error as { context?: { body?: unknown } } | undefined)?.context?.body;
  if (!rawBody) return null;
  try {
    const parsed =
      typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody as { error?: string });
    return typeof parsed?.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}
