alter table public.player_scores
  add column if not exists dx_star_count smallint generated always as (
    case
      when max_dx_score <= 0 then 0
      when dx_score * 100 >= max_dx_score * 97 then 5
      when dx_score * 100 >= max_dx_score * 95 then 4
      when dx_score * 100 >= max_dx_score * 93 then 3
      when dx_score * 100 >= max_dx_score * 90 then 2
      when dx_score * 100 >= max_dx_score * 85 then 1
      else 0
    end
  ) stored;

drop view if exists public.chart_rankings;

create view public.chart_rankings as
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
