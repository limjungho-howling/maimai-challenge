alter table public.profiles
  add column if not exists discord_personal_channel_id text;

alter table public.discord_notifications
  drop constraint if exists discord_notifications_notification_type_check;

alter table public.discord_notifications
  add constraint discord_notifications_notification_type_check
  check (notification_type in ('dm', 'channel', 'personal_channel'));

create index if not exists ranking_events_profile_created_idx
  on public.ranking_events (profile_id, created_at desc);

create index if not exists ranking_events_profile_type_created_idx
  on public.ranking_events (profile_id, event_type, created_at desc);
