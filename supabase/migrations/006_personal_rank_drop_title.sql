create table if not exists public.rank_drop_message_titles (
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_profile_id, target_profile_id),
  check (actor_profile_id <> target_profile_id),
  check (char_length(title) <= 120)
);

alter table public.rank_drop_message_titles enable row level security;

create policy "Users can read own rank drop message titles"
  on public.rank_drop_message_titles
  for select
  using (auth.uid() = actor_profile_id);

create policy "Users can upsert own rank drop message titles"
  on public.rank_drop_message_titles
  for insert
  with check (auth.uid() = actor_profile_id);

create policy "Users can update own rank drop message titles"
  on public.rank_drop_message_titles
  for update
  using (auth.uid() = actor_profile_id)
  with check (auth.uid() = actor_profile_id);

create policy "Users can delete own rank drop message titles"
  on public.rank_drop_message_titles
  for delete
  using (auth.uid() = actor_profile_id);
