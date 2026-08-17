begin;

alter table public.notification_log
  drop constraint if exists notification_log_notification_type_check;
alter table public.notification_log
  add constraint notification_log_notification_type_check
  check (notification_type in (
    'round_started',
    'submission_reminder',
    'rating_started',
    'rating_reminder',
    'round_completed'
  ));

alter table public.group_settings
  add column if not exists phase_reminder_email boolean not null default true;

commit;
