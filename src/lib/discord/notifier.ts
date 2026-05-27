import type { RankingEvent } from "@/lib/maimai/ranking";

export interface DiscordNotificationResult {
  type: "dm" | "channel";
  profileId: string | null;
  status: "sent" | "failed" | "skipped";
  message: string;
  errorMessage: string | null;
}

export interface RankDropNotification {
  profileId: string;
  discordUserId: string | null;
  playerName: string;
  events: Array<
    RankingEvent & {
      chartTitle: string;
      difficultyLabel: string;
    }
  >;
}

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function sendRankDropNotifications(
  notifications: RankDropNotification[],
): Promise<DiscordNotificationResult[]> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    return notifications.map((notification) => ({
      type: "dm",
      profileId: notification.profileId,
      status: "skipped",
      message: buildRankDropMessage(notification),
      errorMessage: "DISCORD_BOT_TOKEN is not configured",
    }));
  }

  const results: DiscordNotificationResult[] = [];

  for (const notification of notifications) {
    const message = buildRankDropMessage(notification);

    if (!notification.discordUserId) {
      results.push({
        type: "dm",
        profileId: notification.profileId,
        status: "skipped",
        message,
        errorMessage: "Discord user id is not linked",
      });
      continue;
    }

    try {
      const channelId = await createDmChannel(token, notification.discordUserId);
      await createMessage(token, channelId, message);
      results.push({
        type: "dm",
        profileId: notification.profileId,
        status: "sent",
        message,
        errorMessage: null,
      });
    } catch (error) {
      results.push({
        type: "dm",
        profileId: notification.profileId,
        status: "failed",
        message,
        errorMessage: getErrorMessage(error),
      });
    }
  }

  return results;
}

export async function sendChannelLog(
  message: string,
): Promise<DiscordNotificationResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_LOG_CHANNEL_ID;

  if (!token || !channelId) {
    return {
      type: "channel",
      profileId: null,
      status: "skipped",
      message,
      errorMessage: "DISCORD_BOT_TOKEN or DISCORD_LOG_CHANNEL_ID is not configured",
    };
  }

  try {
    await createMessage(token, channelId, message);
    return {
      type: "channel",
      profileId: null,
      status: "sent",
      message,
      errorMessage: null,
    };
  } catch (error) {
    return {
      type: "channel",
      profileId: null,
      status: "failed",
      message,
      errorMessage: getErrorMessage(error),
    };
  }
}

function buildRankDropMessage(notification: RankDropNotification): string {
  const lines = notification.events.map((event) => {
    return `- ${event.chartTitle} [${event.difficultyLabel}] ${event.previousRank}위 -> ${event.nextRank}위 (DX ${event.nextDxScore})`;
  });

  return [
    `${notification.playerName}님, maimai Challenge 랭킹 변동이 있습니다.`,
    ...lines,
  ].join("\n");
}

async function createDmChannel(token: string, recipientId: string): Promise<string> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
    method: "POST",
    headers: discordHeaders(token),
    body: JSON.stringify({ recipient_id: recipientId }),
  });

  if (!response.ok) {
    throw new Error(`Discord DM channel failed: ${response.status}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Discord DM channel response did not include an id");
  }

  return payload.id;
}

async function createMessage(
  token: string,
  channelId: string,
  content: string,
): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: discordHeaders(token),
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord message failed: ${response.status}`);
  }
}

function discordHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Discord error";
}
