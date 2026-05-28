alter table public.songs
  add column if not exists jacket_url text;

drop view if exists public.chart_leaderboard_summary;

create view public.chart_leaderboard_summary as
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
