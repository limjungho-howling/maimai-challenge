import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: chartRow } = await sb
  .from("chart_leaderboard_summary")
  .select("chart_id, title, difficulty_label")
  .eq("title", "隠密あんみつDX")
  .eq("difficulty", 3)
  .maybeSingle();
const chartId = chartRow.chart_id;
console.log("chart:", chartRow);

// 현재 전체 순위 (뷰)
const { data: rankings } = await sb
  .from("chart_rankings")
  .select("profile_id, player_name, dx_score, rank, updated_at")
  .eq("chart_id", chartId)
  .order("rank", { ascending: true });
console.log(`\n== CURRENT chart_rankings (${rankings.length} entries) ==`);
for (const r of rankings) {
  console.log(
    `  #${r.rank}  dx=${r.dx_score}  ${r.player_name}  (upd ${r.updated_at})`,
  );
}

// raw player_scores 행 수 (뷰 말고 실제 테이블)
const { data: raw } = await sb
  .from("player_scores")
  .select("profile_id, dx_score, updated_at")
  .eq("chart_id", chartId)
  .order("dx_score", { ascending: false });
console.log(`\n== RAW player_scores rows: ${raw.length} ==`);
const byProfile = new Map();
for (const r of raw) {
  byProfile.set(r.profile_id, (byProfile.get(r.profile_id) ?? 0) + 1);
}
const dupProfiles = [...byProfile.entries()].filter(([, n]) => n > 1);
console.log("  duplicate profile rows:", dupProfiles);

// 이 차트의 모든 ranking_events (가장 최근 run)
const { data: evs } = await sb
  .from("ranking_events")
  .select(
    "ingest_run_id, profile_id, actor_profile_id, event_type, previous_dx_score, next_dx_score, previous_rank, next_rank, created_at",
  )
  .eq("chart_id", chartId)
  .order("created_at", { ascending: false })
  .limit(60);
const latestRun = evs[0]?.ingest_run_id;
const runEvs = evs.filter((e) => e.ingest_run_id === latestRun);
console.log(`\n== ranking_events for latest run ${latestRun} (${runEvs.length}) ==`);
const nameById = new Map(rankings.map((r) => [r.profile_id, r.player_name]));
for (const e of runEvs.sort((a, b) => b.next_dx_score - a.next_dx_score)) {
  console.log(
    `  ${e.event_type}  dx=${e.next_dx_score}  rank ${e.previous_rank}->${e.next_rank}  ${nameById.get(e.profile_id) ?? e.profile_id}${e.actor_profile_id === e.profile_id ? " (ACTOR)" : ""}`,
  );
}
