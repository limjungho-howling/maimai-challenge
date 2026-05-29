update public.song_charts sc
set
  max_dx_score = source.max_dx_score,
  updated_at = now()
from (
  select
    chart_id,
    max(max_dx_score) as max_dx_score
  from public.player_scores
  where max_dx_score > 0
  group by chart_id
) source
where
  sc.id = source.chart_id
  and sc.max_dx_score <= 0;

notify pgrst, 'reload schema';
