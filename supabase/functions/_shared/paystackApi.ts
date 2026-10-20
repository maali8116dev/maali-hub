const PAYSTACK_BASE = "https://api.paystack.co";

export async function paystackRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const raw = await res.text();
  let data: T | null = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data, raw };
}

type PaystackSubscriptionRow = {
  subscription_code?: string;
  email_token?: string;
  status?: string;
  customer?: { customer_code?: string };
};

type PaystackListSubscriptions = {
  status: boolean;
  data: PaystackSubscriptionRow[];
};

export type ResolvedPaystackSubscription = {
  subscriptionCode: string | null;
  customerCode: string | null;
  emailToken: string | null;
};

function pickSubscriptionRow(rows: PaystackSubscriptionRow[]): ResolvedPaystackSubscription {
  const row = rows.find((s) => s.status === "active") ?? rows[0];
  if (!row?.subscription_code) {
    return { subscriptionCode: null, customerCode: null, emailToken: null };
  }
  return {
    subscriptionCode: row.subscription_code,
    customerCode: row.customer?.customer_code ?? null,
    emailToken: row.email_token ?? null,
  };
}

async function listPaystackSubscriptions(
  customer: string,
  planCode?: string | null,
): Promise<PaystackSubscriptionRow[]> {
  let path = `/subscription?customer=${encodeURIComponent(customer)}&perPage=50`;
  if (planCode) path += `&plan=${encodeURIComponent(planCode)}`;
  const res = await paystackRequest<PaystackListSubscriptions>(path);
  return res.ok && res.data?.data?.length ? res.data.data : [];
}

/** Resolve Paystack subscription via customer code, email, and/or payment reference. */
export async function resolvePaystackSubscription(opts: {
  customerCode?: string | null;
  email?: string | null;
  paymentRef?: string | null;
  planCode?: string | null;
}): Promise<ResolvedPaystackSubscription> {
  const { customerCode, email, paymentRef, planCode } = opts;

  if (customerCode?.startsWith("CUS_")) {
    const picked = pickSubscriptionRow(await listPaystackSubscriptions(customerCode, planCode));
    if (picked.subscriptionCode) {
      return { ...picked, customerCode };
    }
  }

  if (email) {
    const byEmail = pickSubscriptionRow(await listPaystackSubscriptions(email, planCode));
    if (byEmail.subscriptionCode) return byEmail;

    const custRes = await paystackRequest<{ data?: { customer_code?: string } }>(
      `/customer/${encodeURIComponent(email)}`,
    );
    const code = custRes.data?.data?.customer_code;
    if (code) {
      const picked = pickSubscriptionRow(await listPaystackSubscriptions(code, planCode));
      if (picked.subscriptionCode) return { ...picked, customerCode: code };
    }
  }

  if (paymentRef) {
    const verifyRes = await paystackRequest<{
      data?: {
        customer?: { customer_code?: string };
        subscription_code?: string;
        subscription?: { subscription_code?: string };
      };
    }>(`/transaction/verify/${encodeURIComponent(paymentRef)}`);
    const tx = verifyRes.data?.data;
    const subFromTx = tx?.subscription_code ?? tx?.subscription?.subscription_code ?? null;
    if (subFromTx) {
      return {
        subscriptionCode: subFromTx,
        customerCode: tx?.customer?.customer_code ?? null,
        emailToken: null,
      };
    }
    const cust = tx?.customer?.customer_code;
    if (cust) {
      const picked = pickSubscriptionRow(await listPaystackSubscriptions(cust, planCode));
      if (picked.subscriptionCode) return { ...picked, customerCode: cust };
    }
  }

  return { subscriptionCode: null, customerCode: null, emailToken: null };
}

/** @deprecated Use resolvePaystackSubscription */
export async function fetchActivePaystackSubscriptionCode(
  customerCode: string | null | undefined,
): Promise<string | null> {
  const resolved = await resolvePaystackSubscription({ customerCode });
  return resolved.subscriptionCode;
}

export async function verifyPaystackSignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const secret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ?? Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const digest = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return digest === signature;
}
