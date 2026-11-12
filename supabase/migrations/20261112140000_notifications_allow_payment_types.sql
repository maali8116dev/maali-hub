-- The edge functions create notifications of type 'payment' (membership
-- activated / expired / payment failed) and 'review_assignment', and the
-- frontend Notification type already includes both, but the check constraint
-- never allowed them — so every one of those notifications was rejected.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'application',
    'system',
    'reminder',
    'new_application',
    'review_assigned',
    'deadline_reminder',
    'status_change',
    'payment',
    'review_assignment'
  ));
