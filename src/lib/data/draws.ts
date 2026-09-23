import { createClient } from "@supabase/supabase-js";

import type { RandomPoolChart } from "@/lib/random/pool";
import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";

export interface RandomDrawRecord {
  id: string;
  drawerName: string;
  poolHash: string;
  pool: RandomPoolChart[];
  poolSize: number;
  beaconChain: string;
  beaconRound: number;
  beaconAvailableAt: string;
  committedAt: string;
  revealedAt: string | null;
  beaconRandomness: string | null;
  beaconSignature: string | null;
  winnerIndex: number | null;
  winnerChartId: string | null;
  winnerTitle: string | null;
}

export async function getRandomDraw(id: string): Promise<RandomDrawRecord | null> {
  if (!hasSupabasePublicEnv() || !isUuid(id)) {
    return null;
  }

  const { data, error } = await createReadClient()
    .from("random_draws")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDraw(data);
}

export async function listRandomDraws(limit = 50): Promise<RandomDrawRecord[]> {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const { data, error } = await createReadClient()
    .from("random_draws")
    .select("*")
    .order("committed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map(mapDraw);
}

/**
 * Earlier draws that locked the exact same pool. Surfaced on the draw page so
 * a re-roll is visible to whoever is handed the link.
 */
export async function listEarlierDrawsForPool(
  poolHash: string,
  before: string,
): Promise<
  Array<{
    id: string;
    committedAt: string;
    winnerTitle: string | null;
    drawerName: string;
  }>
> {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const { data, error } = await createReadClient()
    .from("random_draws")
    .select("id,committed_at,winner_title,drawer_name")
    .eq("pool_hash", poolHash)
    .lt("committed_at", before)
    .order("committed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    committedAt: String(row.committed_at),
    winnerTitle: typeof row.winner_title === "string" ? row.winner_title : null,
    drawerName:
      typeof row.drawer_name === "string" ? row.drawer_name : "알 수 없음",
  }));
}

export function mapDraw(row: Record<string, unknown>): RandomDrawRecord {
  return {
    id: String(row.id),
    drawerName:
      typeof row.drawer_name === "string" ? row.drawer_name : "알 수 없음",
    poolHash: String(row.pool_hash),
    pool: Array.isArray(row.pool) ? (row.pool as RandomPoolChart[]) : [],
    poolSize: Number(row.pool_size),
    beaconChain: String(row.beacon_chain),
    beaconRound: Number(row.beacon_round),
    beaconAvailableAt: String(row.beacon_available_at),
    committedAt: String(row.committed_at),
    revealedAt: typeof row.revealed_at === "string" ? row.revealed_at : null,
    beaconRandomness:
      typeof row.beacon_randomness === "string" ? row.beacon_randomness : null,
    beaconSignature:
      typeof row.beacon_signature === "string" ? row.beacon_signature : null,
    winnerIndex:
      row.winner_index === null || row.winner_index === undefined
        ? null
        : Number(row.winner_index),
    winnerChartId:
      typeof row.winner_chart_id === "string" ? row.winner_chart_id : null,
    winnerTitle: typeof row.winner_title === "string" ? row.winner_title : null,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function createReadClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
