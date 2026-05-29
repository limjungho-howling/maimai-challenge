import type { RankingEvent } from "@/lib/maimai/ranking";
import {
  buildChannelRankUpMessages,
  buildPersonalRankDropMessages,
  type ChannelRankUpEvent,
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
const DISCORD_PERMISSION_VIEW_CHANNEL = 1024;
const DISCORD_PERMISSION_SEND_MESSAGES = 2048;
const DISCORD_PERMISSION_READ_MESSAGE_HISTORY = 65536;
const PERSONAL_CHANNEL_READER_ALLOW = (
  DISCORD_PERMISSION_VIEW_CHANNEL | DISCORD_PERMISSION_READ_MESSAGE_HISTORY
).toString();
const PERSONAL_CHANNEL_READER_DENY = DISCORD_PERMISSION_SEND_MESSAGES.toString();
const PERSONAL_CHANNEL_BOT_ALLOW = (
  DISCORD_PERMISSION_VIEW_CHANNEL |
  DISCORD_PERMISSION_SEND_MESSAGES |
  DISCORD_PERMISSION_READ_MESSAGE_HISTORY
).toString();
const DISCORD_SUPPRESS_EMBEDS_FLAG = 4;
let cachedBotUserId: string | null = null;

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
  actorName: string;
  events: PersonalRankDropEvent[];
}

export interface ChannelRankUpNotification {
  actorName: string;
  events: ChannelRankUpEvent[];
}

export async function ensurePersonalChannel({
  profileId,
  discordUserId,
  discordUsername,
  personalChannelId,
  playerName,
}: {
  profileId: string;
  discordUserId: string;
  discordUsername: string | null;
  personalChannelId?: string | null;
  playerName: string;
}): Promise<DiscordNotificationResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const message = "Discord personal channel prepared";

  if (!token || !guildId) {
    return {
      type: "personal_channel",
      profileId,
      status: "skipped",
      message,
      errorMessage: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not configured",
    };
  }

  try {
    const channelId =
      personalChannelId ??
      (await createPersonalGuildChannel({
        token,
        guildId,
        discordUserId,
        discordUsername,
        playerName,
      }));

    if (personalChannelId) {
      await syncPersonalGuildChannelPermissions({
        token,
        guildId,
        channelId,
        discordUserId,
      });
    }

    return {
      type: "personal_channel",
      profileId,
      status: "sent",
      message,
      errorMessage: null,
      channelId,
    };
  } catch (error) {
    return {
      type: "personal_channel",
      profileId,
      status: "failed",
      message,
      errorMessage: getErrorMessage(error),
    };
  }
}

export async function sendPersonalRankDropNotifications(
  notifications: PersonalChannelNotification[],
): Promise<DiscordNotificationResult[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return notifications.flatMap((notification) =>
      buildPersonalRankDropMessages({
        ...notification,
        appUrl: getAppUrl(),
      }).map((message) => ({
        type: "personal_channel" as const,
        profileId: notification.profileId,
        status: "skipped" as const,
        message,
        errorMessage: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not configured",
        channelId: notification.personalChannelId,
      })),
    );
  }

  const results: DiscordNotificationResult[] = [];

  for (const notification of notifications) {
    const messages = buildPersonalRankDropMessages({
      ...notification,
      appUrl: getAppUrl(),
    });

    if (!notification.discordUserId) {
      results.push(...messages.map((message) => ({
        type: "personal_channel" as const,
        profileId: notification.profileId,
        status: "skipped" as const,
        message,
        errorMessage: "Discord user id is not linked",
        channelId: notification.personalChannelId,
      })));
      continue;
    }

    let channelId: string;
    try {
      channelId =
        notification.personalChannelId ??
        (await createPersonalGuildChannel({
          token,
          guildId,
          discordUserId: notification.discordUserId,
          discordUsername: notification.discordUsername,
          playerName: notification.playerName,
        }));
    } catch (error) {
      results.push(...messages.map((message) => ({
        type: "personal_channel" as const,
        profileId: notification.profileId,
        status: "failed" as const,
        message,
        errorMessage: getErrorMessage(error),
        channelId: notification.personalChannelId,
      })));
      continue;
    }

    for (const message of messages) {
      try {
        await createMessageWithRetry(token, channelId, message);
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
          channelId,
        });
      }
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

export async function sendChannelRankUpLogs({
  actorName,
  events,
}: ChannelRankUpNotification): Promise<DiscordNotificationResult[]> {
  const messages = buildChannelRankUpMessages({
    actorName,
    events,
    appUrl: getAppUrl(),
  });
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = getChallengeLogChannelId();

  if (!token || !channelId) {
    return messages.map((message) => ({
      type: "channel" as const,
      profileId: null,
      status: "skipped" as const,
      message,
      errorMessage: "DISCORD_BOT_TOKEN or DISCORD_LOG_CHANNEL_ID is not configured",
      channelId,
    }));
  }

  const results: DiscordNotificationResult[] = [];

  for (const message of messages) {
    try {
      await createMessageWithRetry(token, channelId, message);
      results.push({
        type: "channel",
        profileId: null,
        status: "sent",
        message,
        errorMessage: null,
        channelId,
      });
    } catch (error) {
      const discordError = getDiscordApiError(error);
      results.push({
        type: "channel",
        profileId: null,
        status: "failed",
        message,
        errorMessage:
          discordError?.code === 50001
            ? "Discord log channel failed: bot is missing access to DISCORD_LOG_CHANNEL_ID. Add the bot to the server/channel and grant View Channel + Send Messages."
            : getErrorMessage(error),
        channelId,
      });
    }
  }

  return results;
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
      flags: DISCORD_SUPPRESS_EMBEDS_FLAG,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw await createDiscordHttpError(response, "Discord message failed");
  }
}

async function createMessageWithRetry(
  token: string,
  channelId: string,
  content: string,
): Promise<void> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await createMessage(token, channelId, content);
      return;
    } catch (error) {
      const discordError = getDiscordApiError(error);
      if (discordError?.status !== 429 || attempt === maxAttempts) {
        throw error;
      }

      await sleep(discordError.retryAfterMs ?? attempt * 1000);
    }
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
  const botUserId = await getBotUserId(token);
  const body: Record<string, unknown> = {
    name,
    type: 0,
    permission_overwrites: [
      {
        id: guildId,
        type: 0,
        allow: PERSONAL_CHANNEL_READER_ALLOW,
        deny: PERSONAL_CHANNEL_READER_DENY,
      },
      {
        id: botUserId,
        type: 1,
        allow: PERSONAL_CHANNEL_BOT_ALLOW,
        deny: "0",
      },
      {
        id: discordUserId,
        type: 1,
        allow: PERSONAL_CHANNEL_BOT_ALLOW,
        deny: "0",
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

async function syncPersonalGuildChannelPermissions({
  token,
  guildId,
  channelId,
  discordUserId,
}: {
  token: string;
  guildId: string;
  channelId: string;
  discordUserId: string;
}): Promise<void> {
  const botUserId = await getBotUserId(token);

  await Promise.all([
    upsertChannelPermissionOverwrite({
      token,
      channelId,
      overwriteId: guildId,
      type: 0,
      allow: PERSONAL_CHANNEL_READER_ALLOW,
      deny: PERSONAL_CHANNEL_READER_DENY,
    }),
    upsertChannelPermissionOverwrite({
      token,
      channelId,
      overwriteId: discordUserId,
      type: 1,
      allow: PERSONAL_CHANNEL_BOT_ALLOW,
      deny: "0",
    }),
    upsertChannelPermissionOverwrite({
      token,
      channelId,
      overwriteId: botUserId,
      type: 1,
      allow: PERSONAL_CHANNEL_BOT_ALLOW,
      deny: "0",
    }),
  ]);
}

async function upsertChannelPermissionOverwrite({
  token,
  channelId,
  overwriteId,
  type,
  allow,
  deny,
}: {
  token: string;
  channelId: string;
  overwriteId: string;
  type: 0 | 1;
  allow: string;
  deny: string;
}): Promise<void> {
  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/permissions/${overwriteId}`,
    {
      method: "PUT",
      headers: discordHeaders(token),
      body: JSON.stringify({ type, allow, deny }),
    },
  );

  if (!response.ok) {
    throw await createDiscordHttpError(response, "Discord channel permission failed");
  }
}

async function getBotUserId(token: string): Promise<string> {
  if (cachedBotUserId) {
    return cachedBotUserId;
  }

  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: discordHeaders(token),
  });

  if (!response.ok) {
    throw await createDiscordHttpError(response, "Discord bot user lookup failed");
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Discord bot user response did not include an id");
  }

  cachedBotUserId = payload.id;
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

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://maimai-challenge.vercel.app"
  );
}

function getChallengeLogChannelId(): string | null {
  return process.env.DISCORD_CHALLENGE_LOG_CHANNEL_ID ?? "1509087713888964668";
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
  retryAfterMs?: number;
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
    const payload = (await response.json()) as {
      code?: unknown;
      message?: unknown;
      retry_after?: unknown;
    };
    const retryAfter =
      typeof payload.retry_after === "number" ? payload.retry_after : null;
    return {
      status: response.status,
      code: typeof payload.code === "number" ? payload.code : null,
      message: typeof payload.message === "string" ? payload.message : null,
      retryAfterMs: retryAfter === null ? undefined : Math.ceil(retryAfter * 1000),
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
