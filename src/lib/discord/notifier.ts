import type { RankingEvent } from "@/lib/maimai/ranking";
import {
  buildPersonalRankDropMessage,
  type PersonalRankDropEvent,
} from "@/lib/discord/messages";

export interface DiscordNotificationResult {
  type: "dm" | "channel" | "personal_channel";
  profileId: string | null;
  status: "sent" | "failed" | "skipped";
  message: string;
  errorMessage: string | null;
  channelId?: string | null;
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

export interface PersonalChannelNotification {
  profileId: string;
  discordUserId: string | null;
  discordUsername: string | null;
  personalChannelId: string | null;
  playerName: string;
  events: PersonalRankDropEvent[];
}

export async function sendPersonalRankDropNotifications(
  notifications: PersonalChannelNotification[],
): Promise<DiscordNotificationResult[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return notifications.map((notification) => ({
      type: "personal_channel",
      profileId: notification.profileId,
      status: "skipped",
      message: buildPersonalRankDropMessage(notification),
      errorMessage: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not configured",
      channelId: notification.personalChannelId,
    }));
  }

  const results: DiscordNotificationResult[] = [];

  for (const notification of notifications) {
    const message = buildPersonalRankDropMessage(notification);

    if (!notification.discordUserId) {
      results.push({
        type: "personal_channel",
        profileId: notification.profileId,
        status: "skipped",
        message,
        errorMessage: "Discord user id is not linked",
        channelId: notification.personalChannelId,
      });
      continue;
    }

    try {
      const channelId =
        notification.personalChannelId ??
        (await createPersonalGuildChannel({
          token,
          guildId,
          discordUserId: notification.discordUserId,
          discordUsername: notification.discordUsername,
          playerName: notification.playerName,
        }));
      await createMessage(token, channelId, message);
      results.push({
        type: "personal_channel",
        profileId: notification.profileId,
        status: "sent",
        message,
        errorMessage: null,
        channelId,
      });
    } catch (error) {
      results.push({
        type: "personal_channel",
        profileId: notification.profileId,
        status: "failed",
        message,
        errorMessage: getErrorMessage(error),
        channelId: notification.personalChannelId,
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
    const discordError = getDiscordApiError(error);
    return {
      type: "channel",
      profileId: null,
      status: "failed",
      message,
      errorMessage:
        discordError?.code === 50001
          ? "Discord log channel failed: bot is missing access to DISCORD_LOG_CHANNEL_ID. Add the bot to the server/channel and grant View Channel + Send Messages."
          : getErrorMessage(error),
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
    throw await createDiscordHttpError(response, "Discord DM channel failed");
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
    throw await createDiscordHttpError(response, "Discord message failed");
  }
}

async function createPersonalGuildChannel({
  token,
  guildId,
  discordUserId,
  discordUsername,
  playerName,
}: {
  token: string;
  guildId: string;
  discordUserId: string;
  discordUsername: string | null;
  playerName: string;
}): Promise<string> {
  const categoryId = process.env.DISCORD_PERSONAL_CHANNEL_CATEGORY_ID;
  const name = makePersonalChannelName(discordUsername ?? playerName);
  const body: Record<string, unknown> = {
    name,
    type: 0,
    permission_overwrites: [
      {
        id: guildId,
        type: 0,
        deny: "1024",
      },
      {
        id: discordUserId,
        type: 1,
        allow: "68608",
      },
    ],
  };

  if (categoryId) {
    body.parent_id = categoryId;
  }

  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: discordHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await createDiscordHttpError(response, "Discord personal channel failed");
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Discord channel response did not include an id");
  }

  return payload.id;
}

function makePersonalChannelName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `maimai-${normalized || "player"}`;
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

interface DiscordApiError {
  status: number;
  code: number | null;
  message: string | null;
}

async function createDiscordHttpError(
  response: Response,
  prefix: string,
): Promise<Error & { discord?: DiscordApiError }> {
  const discord = await readDiscordError(response);
  const detail = [
    `${prefix}: ${response.status}`,
    discord.code === null ? null : `code ${discord.code}`,
    discord.message,
  ]
    .filter(Boolean)
    .join(" - ");
  const error = new Error(detail) as Error & { discord?: DiscordApiError };
  error.discord = discord;
  return error;
}

async function readDiscordError(response: Response): Promise<DiscordApiError> {
  try {
    const payload = (await response.json()) as { code?: unknown; message?: unknown };
    return {
      status: response.status,
      code: typeof payload.code === "number" ? payload.code : null,
      message: typeof payload.message === "string" ? payload.message : null,
    };
  } catch {
    return {
      status: response.status,
      code: null,
      message: null,
    };
  }
}

function getDiscordApiError(error: unknown): DiscordApiError | null {
  if (
    error &&
    typeof error === "object" &&
    "discord" in error &&
    typeof (error as { discord?: unknown }).discord === "object"
  ) {
    return (error as { discord: DiscordApiError }).discord;
  }

  return null;
}
