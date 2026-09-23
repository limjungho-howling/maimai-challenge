"use server";

import { z } from "zod";

import { mapDraw, type RandomDrawRecord } from "@/lib/data/draws";
import {
  DRAND_CHAIN_HASH,
  fetchDrandRound,
  roundAvailableAtMs,
  targetRoundAt,
} from "@/lib/random/drand";
import { MAX_POOL_SIZE, type RandomPoolChart } from "@/lib/random/pool";
import { hashPool, pickWinnerIndex } from "@/lib/random/verifiable";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

const commitInputSchema = z.object({
  chartIds: z.array(z.uuid()).min(1).max(MAX_POOL_SIZE),
});

export interface CommitResult {
  draw: RandomDrawRecord;
  earlierDrawCount: number;
}

/**
 * Locks the pool against a drand round that has not been published yet. The
 * randomness deciding the winner does not exist at this point, so neither the
 * drawer nor this server can steer the outcome.
 */
export async function commitRandomDraw(input: unknown): Promise<CommitResult> {
  const parsed = commitInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("선곡 풀이 올바르지 않습니다.");
  }

  // Draws are attributable on purpose: an anonymous record cannot be held to
  // account for a re-roll, which is the whole point of recording them.
  const drawer = await requireDrawer();

  const requestedIds = [...new Set(parsed.data.chartIds)];
  const supabase = createSupabaseServiceClient();

  // Never trust the client's snapshot: the recorded pool is rebuilt from the
  // catalog so a draw record cannot contain charts that do not exist.
  const pool = await loadPoolFromCatalog(supabase, requestedIds);
  const chartIds = pool.map((chart) => chart.chartId);
  const poolHash = await hashPool(chartIds);

  const now = Date.now();
  const beaconRound = targetRoundAt(now);
  const beaconAvailableAt = new Date(roundAvailableAtMs(beaconRound)).toISOString();

  const earlierDrawCount = await countEarlierDraws(supabase, poolHash);

  const { data, error } = await supabase
    .from("random_draws")
    .insert({
      profile_id: drawer.profileId,
      drawer_name: drawer.name,
      pool_hash: poolHash,
      pool,
      pool_size: pool.length,
      beacon_chain: DRAND_CHAIN_HASH,
      beacon_round: beaconRound,
      beacon_available_at: beaconAvailableAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("선곡을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return { draw: mapDraw(data), earlierDrawCount };
}

/**
 * Publishes the result. Idempotent: once a draw is revealed it always returns
 * the same winner, so calling this again can never produce a second outcome.
 */
export async function revealRandomDraw(drawId: unknown): Promise<RandomDrawRecord> {
  const parsedId = z.uuid().safeParse(drawId);

  if (!parsedId.success) {
    throw new Error("선곡 기록을 찾을 수 없습니다.");
  }

  const supabase = createSupabaseServiceClient();
  const { data: existing, error: loadError } = await supabase
    .from("random_draws")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (loadError || !existing) {
    throw new Error("선곡 기록을 찾을 수 없습니다.");
  }

  const draw = mapDraw(existing);

  if (draw.revealedAt) {
    return draw;
  }

  if (Date.now() < new Date(draw.beaconAvailableAt).getTime()) {
    throw new Error("아직 추첨 난수가 공개되지 않았습니다.");
  }

  const round = await fetchDrandRound(draw.beaconRound);
  const chartIds = draw.pool.map((chart) => chart.chartId);
  const winnerIndex = await pickWinnerIndex(round.randomness, chartIds);
  const winner = draw.pool[winnerIndex];

  const { data: revealed, error: revealError } = await supabase
    .from("random_draws")
    .update({
      revealed_at: new Date().toISOString(),
      beacon_randomness: round.randomness,
      beacon_signature: round.signature,
      winner_index: winnerIndex,
      winner_chart_id: winner.chartId,
      winner_title: winner.title,
    })
    .eq("id", draw.id)
    .is("revealed_at", null)
    .select("*")
    .maybeSingle();

  if (revealError) {
    console.error(revealError);
    throw new Error("선곡 결과를 기록하지 못했습니다.");
  }

  if (revealed) {
    return mapDraw(revealed);
  }

  // Another request revealed it first; return whatever was written.
  const { data: settled } = await supabase
    .from("random_draws")
    .select("*")
    .eq("id", draw.id)
    .maybeSingle();

  if (!settled) {
    throw new Error("선곡 기록을 찾을 수 없습니다.");
  }

  return mapDraw(settled);
}

const LOGIN_REQUIRED_MESSAGE = "검증 선곡은 Discord 로그인이 필요합니다.";

async function requireDrawer(): Promise<{ profileId: string; name: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(LOGIN_REQUIRED_MESSAGE);
  }

  const { data: profile } = await createSupabaseServiceClient()
    .from("profiles")
    .select("maimai_name,discord_username")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    (typeof profile?.maimai_name === "string" && profile.maimai_name) ||
    (typeof profile?.discord_username === "string" && profile.discord_username) ||
    "알 수 없음";

  return { profileId: user.id, name };
}

async function loadPoolFromCatalog(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  chartIds: string[],
): Promise<RandomPoolChart[]> {
  const { data, error } = await supabase
    .from("chart_leaderboard_summary")
    .select("chart_id,title,jacket_url,kind,difficulty,level,version_name")
    .in("chart_id", chartIds);

  if (error) {
    console.error(error);
    throw new Error("곡 정보를 불러오지 못했습니다.");
  }

  const byId = new Map(
    (data ?? []).map((row) => [
      String(row.chart_id),
      {
        chartId: String(row.chart_id),
        title: String(row.title),
        jacketUrl: typeof row.jacket_url === "string" ? row.jacket_url : null,
        kind: String(row.kind),
        difficulty: Number(row.difficulty),
        level: String(row.level),
        versionName:
          typeof row.version_name === "string" ? row.version_name : null,
      } satisfies RandomPoolChart,
    ]),
  );

  // Keep the order the drawer committed — it is part of the pool hash.
  const pool = chartIds.map((chartId) => byId.get(chartId)).filter(Boolean);

  if (pool.length !== chartIds.length) {
    throw new Error("선곡 풀에 존재하지 않는 곡이 있습니다.");
  }

  return pool as RandomPoolChart[];
}

async function countEarlierDraws(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  poolHash: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("random_draws")
    .select("id", { count: "exact", head: true })
    .eq("pool_hash", poolHash);

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
}
