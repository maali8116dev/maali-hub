import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://alpudhhsmgtpmgpjfuqs.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

describe('email_queue / claim_email_batch (DB Integration)', () => {
  const createdIds: string[] = [];
  let queueAvailable = true;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      // eslint-disable-next-line no-console
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping email_queue integration tests.');
      return;
    }

    // Seed a few email_queue rows in different states
    const now = new Date();
    const past = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour ahead

    const { data, error } = await (supabaseAdmin as any)
      .from('email_queue')
      .insert([
        {
          type: 'payment_receipt',
          to_email: 'test1@maali.test',
          payload: { foo: 'bar-1' },
          status: 'pending',
          next_attempt_at: past,
          idempotency_key: `int-email-queue-${Date.now()}-1`,
        },
        {
          type: 'payment_receipt',
          to_email: 'test2@maali.test',
          payload: { foo: 'bar-2' },
          status: 'failed',
          next_attempt_at: past,
          idempotency_key: `int-email-queue-${Date.now()}-2`,
        },
        {
          // This one should NOT be claimed because next_attempt_at is in the future
          type: 'payment_receipt',
          to_email: 'test3@maali.test',
          payload: { foo: 'bar-3' },
          status: 'pending',
          next_attempt_at: future,
          idempotency_key: `int-email-queue-${Date.now()}-3`,
        },
      ])
      .select('id');

    if (error) {
      // Some environments may not have this table/migration yet.
      if (error.message?.includes("Could not find the table 'public.email_queue'")) {
        queueAvailable = false;
        return;
      }
      throw new Error(`Failed to seed email_queue: ${error.message}`);
    }

    for (const row of data || []) {
      createdIds.push(row.id as string);
    }
  });

  afterAll(async () => {
    if (!supabaseAdmin || createdIds.length === 0) return;

    try {
      await (supabaseAdmin as any).from('email_queue').delete().in('id', createdIds);
    } catch {
      // Swallow cleanup errors in tests
    }
  });

  it(
    'claims only ready rows and marks them processing atomically',
    async () => {
      if (!supabaseAdmin) {
        return;
      }
      if (!queueAvailable) {
        return;
      }

      // 1) Call the claim_email_batch function with a batch size larger than ready rows.
      const { data: claimed, error: claimError } = await (supabaseAdmin as any).rpc('claim_email_batch', {
        p_limit: 10,
      });

      expect(claimError).toBeNull();
      expect(claimed).toBeDefined();

      // We seeded 2 rows that are ready (past next_attempt_at) and 1 that is future-dated.
      // Only the 2 ready ones should be claimed.
      expect((claimed as any[])!.length).toBe(2);

      const claimedIds = new Set((claimed as any[])!.map((row: any) => row.id as string));
      expect(createdIds.filter((id) => claimedIds.has(id)).length).toBe(2);

      // 2) Verify in DB that claimed rows are now status='processing'
      const { data: processingRows, error: checkError } = await (supabaseAdmin as any)
        .from('email_queue')
        .select('id, status, next_attempt_at')
        .in('id', createdIds);

      expect(checkError).toBeNull();
      expect(processingRows).toBeDefined();

      const byId: Record<string, any> = {};
      for (const row of processingRows || []) {
        byId[row.id as string] = row;
      }

      // Ready ones must be processing
      for (const id of createdIds.slice(0, 2)) {
        expect(byId[id]).toBeDefined();
        expect(byId[id].status).toBe('processing');
      }

      // Future-dated one should remain pending
      const futureId = createdIds[2];
      expect(byId[futureId]).toBeDefined();
      expect(byId[futureId].status).toBe('pending');
    },
    30000
  );
});










