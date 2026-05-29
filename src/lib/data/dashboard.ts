import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export interface DashboardProfile {
  id: string;
  discordUserId: string | null;
  maimaiName: string | null;
  maimaiRating: number | null;
  trophy: string | null;
  dmAlertsEnabled: boolean;
  discordUsername: string | null;
}

export interface DashboardRankDropTitleSetting {
  targetProfileId: string;
  targetName: string;
  discordUsername: string | null;
  title: string | null;
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
  rankDropTitleSettings: DashboardRankDropTitleSetting[];
}> {
  if (!hasSupabasePublicEnv()) {
    return { userId: null, profile: null, ingestRuns: [], rankDropTitleSettings: [] };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, profile: null, ingestRuns: [], rankDropTitleSettings: [] };
  }

  const serviceSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceClient()
    : null;
  const profileListClient = serviceSupabase ?? supabase;
  const [
    { data: profile },
    { data: ingestRuns },
    { data: profiles, error: profilesError },
    { data: titleRows, error: titleRowsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, discord_user_id, maimai_name, maimai_rating, trophy, dm_alerts_enabled, discord_username",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("ingest_runs")
      .select("id, status, player_name, score_count, changed_chart_count, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    profileListClient
      .from("profiles")
      .select("id, maimai_name, discord_username")
      .not("maimai_name", "is", null)
      .order("maimai_name", { ascending: true }),
    profileListClient
      .from("rank_drop_message_titles")
      .select("target_profile_id, title")
      .eq("actor_profile_id", user.id),
  ]);

  if (profilesError) {
    console.error("Failed to load dashboard profile list", profilesError);
  }

  if (titleRowsError) {
    console.error("Failed to load rank drop message titles", titleRowsError);
  }

  const titleByTargetProfileId = new Map(
    (titleRows ?? []).map((row) => [String(row.target_profile_id), String(row.title)]),
  );

  return {
    userId: user.id,
    profile: profile
      ? {
          id: profile.id,
          discordUserId: profile.discord_user_id,
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
    rankDropTitleSettings: (profiles ?? [])
      .filter((item) => item.id !== user.id)
      .map((item) => ({
        targetProfileId: String(item.id),
        targetName: item.maimai_name ?? "미등록",
        discordUsername: item.discord_username,
        title: titleByTargetProfileId.get(String(item.id)) ?? null,
      })),
  };
}
