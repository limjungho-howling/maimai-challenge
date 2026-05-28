create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text unique,
  discord_username text,
  discord_personal_channel_id text,
  maimai_name text,
  maimai_rating integer,
  trophy text,
  current_version_play_count integer,
  total_play_count integer,
  dm_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('DX', 'STANDARD')),
  jacket_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, kind)
);

create table if not exists public.song_charts (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  difficulty smallint not null check (difficulty between 0 and 4),
  difficulty_label text not null,
  level text not null,
  genre text,
  max_dx_score integer not null,
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, difficulty)
);

create table if not exists public.player_scores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chart_id uuid not null references public.song_charts(id) on delete cascade,
  achievement_rate numeric(8, 4),
  dx_score integer not null,
  max_dx_score integer not null,
  dx_star_count smallint generated always as (
    case
      when max_dx_score <= 0 then 0
      when dx_score * 100 >= max_dx_score * 97 then 5
      when dx_score * 100 >= max_dx_score * 95 then 4
      when dx_score * 100 >= max_dx_score * 93 then 3
      when dx_score * 100 >= max_dx_score * 90 then 2
      when dx_score * 100 >= max_dx_score * 85 then 1
      else 0
    end
  ) stored,
  official_idx text,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, chart_id)
);

create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  player_name text,
  status text not null check (status in ('started', 'completed', 'failed')),
  score_count integer not null default 0,
  changed_chart_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chart_id uuid not null references public.song_charts(id) on delete cascade,
  ingest_run_id uuid references public.ingest_runs(id) on delete set null,
  previous_dx_score integer,
  next_dx_score integer not null,
  previous_rank integer,
  next_rank integer,
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_events (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.song_charts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  ingest_run_id uuid references public.ingest_runs(id) on delete set null,
  event_type text not null check (event_type in ('score_changed', 'rank_changed', 'rank_dropped')),
  previous_dx_score integer,
  next_dx_score integer not null,
  previous_rank integer,
  next_rank integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.discord_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  ingest_run_id uuid references public.ingest_runs(id) on delete set null,
  notification_type text not null check (notification_type in ('dm', 'channel', 'personal_channel')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  message text,
  error_message text,
  created_at timestamptz not null default now()
);

create or replace view public.chart_leaderboard_summary as
with ranked as (
  select
    ps.chart_id,
    p.maimai_name,
    ps.dx_score,
    rank() over (partition by ps.chart_id order by ps.dx_score desc) as rank
  from public.player_scores ps
  join public.profiles p on p.id = ps.profile_id
),
leaders as (
  select
    chart_id,
    max(dx_score) as leader_dx_score,
    min(maimai_name) filter (where rank = 1) as leader_name,
    count(*) filter (where rank = 1) as leader_count
  from ranked
  group by chart_id
)
select
  sc.id as chart_id,
  s.title,
  s.jacket_url,
  s.kind,
  sc.difficulty,
  sc.difficulty_label,
  sc.level,
  sc.genre,
  sc.max_dx_score,
  sc.last_changed_at,
  leaders.leader_dx_score,
  leaders.leader_name,
  coalesce(leaders.leader_count, 0) as leader_count
from public.song_charts sc
join public.songs s on s.id = sc.song_id
left join leaders on leaders.chart_id = sc.id;

create or replace view public.chart_rankings as
select
  ps.chart_id,
  ps.profile_id,
  p.maimai_name as player_name,
  p.discord_username,
  ps.achievement_rate,
  ps.dx_score,
  ps.max_dx_score,
  ps.dx_star_count,
  ps.updated_at,
  rank() over (partition by ps.chart_id order by ps.dx_score desc) as rank
from public.player_scores ps
join public.profiles p on p.id = ps.profile_id;

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.song_charts enable row level security;
alter table public.player_scores enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.score_snapshots enable row level security;
alter table public.ranking_events enable row level security;
alter table public.discord_notifications enable row level security;

create policy "Public songs are readable" on public.songs for select using (true);
create policy "Public charts are readable" on public.song_charts for select using (true);
create policy "Public scores are readable" on public.player_scores for select using (true);
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own alert settings" on public.profiles for update using (auth.uid() = id);
create policy "Users can read own ingest runs" on public.ingest_runs for select using (auth.uid() = profile_id);
create policy "Users can read own notifications" on public.discord_notifications for select using (auth.uid() = profile_id);
