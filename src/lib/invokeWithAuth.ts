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

export async function parseEdgeFunctionError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;

  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const parsed = (await ctx.clone().json()) as { error?: string };
      if (typeof parsed?.error === "string") return parsed.error;
    } catch {
      /* fall through */
    }
  }

  const rawBody = (error as { context?: { body?: unknown } }).context?.body;
  if (!rawBody) return null;
  try {
    const parsed =
      typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody as { error?: string });
    return typeof parsed?.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}
