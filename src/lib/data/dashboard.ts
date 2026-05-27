import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DashboardProfile {
  id: string;
  maimaiName: string | null;
  maimaiRating: number | null;
  trophy: string | null;
  dmAlertsEnabled: boolean;
  discordUsername: string | null;
}

export interface DashboardIngestRun {
  id: string;
  status: string;
  playerName: string | null;
  scoreCount: number;
  changedChartCount: number;
  createdAt: string;
}

export async function getDashboardData(): Promise<{
  userId: string | null;
  profile: DashboardProfile | null;
  ingestRuns: DashboardIngestRun[];
}> {
  if (!hasSupabasePublicEnv()) {
    return { userId: null, profile: null, ingestRuns: [] };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, profile: null, ingestRuns: [] };
  }

  const [{ data: profile }, { data: ingestRuns }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, maimai_name, maimai_rating, trophy, dm_alerts_enabled, discord_username",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("ingest_runs")
      .select("id, status, player_name, score_count, changed_chart_count, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    userId: user.id,
    profile: profile
      ? {
          id: profile.id,
          maimaiName: profile.maimai_name,
          maimaiRating: profile.maimai_rating,
          trophy: profile.trophy,
          dmAlertsEnabled: Boolean(profile.dm_alerts_enabled),
          discordUsername: profile.discord_username,
        }
      : null,
    ingestRuns: (ingestRuns ?? []).map((run) => ({
      id: run.id,
      status: run.status,
      playerName: run.player_name,
      scoreCount: Number(run.score_count),
      changedChartCount: Number(run.changed_chart_count),
      createdAt: run.created_at,
    })),
  };
}
