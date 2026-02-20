-- ============================================
-- Enable Realtime for Notifications Table
-- ============================================
-- This enables Supabase Realtime subscriptions for the notifications table
-- Required for real-time notification updates without polling

-- Add notifications table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

