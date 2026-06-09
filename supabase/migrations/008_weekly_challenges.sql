create table if not exists public.weekly_challenge_weeks (
  id uuid primary key default gen_random_uuid(),
  week_key text not null unique,
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_challenge_picks (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weekly_challenge_weeks(id) on delete cascade,
  category text not null check (category in ('low', 'middle')),
  chart_id uuid not null references public.song_charts(id) on delete restrict,
  leader_dx_score_snapshot integer,
  leader_name_snapshot text,
  leader_count_snapshot integer not null default 0,
  created_at timestamptz not null default now(),
  unique (week_id, category),
  unique (week_id, chart_id)
);

create table if not exists public.weekly_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weekly_challenge_weeks(id) on delete cascade,
  pick_id uuid not null references public.weekly_challenge_picks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ingest_run_id uuid references public.ingest_runs(id) on delete set null,
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
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, pick_id, profile_id)
);

create table if not exists public.weekly_challenge_results (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weekly_challenge_weeks(id) on delete cascade,
  pick_id uuid not null references public.weekly_challenge_picks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
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
  rank integer not null,
  submitted_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (week_id, pick_id, profile_id)
);

alter table public.weekly_challenge_weeks enable row level security;
alter table public.weekly_challenge_picks enable row level security;
alter table public.weekly_challenge_entries enable row level security;
alter table public.weekly_challenge_results enable row level security;

create policy "Public weekly challenge weeks are readable"
  on public.weekly_challenge_weeks for select using (true);

create policy "Public weekly challenge picks are readable"
  on public.weekly_challenge_picks for select using (true);

create policy "Public weekly challenge entries are readable"
  on public.weekly_challenge_entries for select using (true);

create policy "Public weekly challenge results are readable"
  on public.weekly_challenge_results for select using (true);
