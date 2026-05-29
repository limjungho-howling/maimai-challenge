import type { User } from "@supabase/supabase-js";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MAIMAI_CHALLENGE_GUILD_ID = "1509077747140657273";

export async function isUserInAllowedDiscordGuild(user: User): Promise<boolean> {
  const discordUserId = getDiscordUserId(user);
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId =
    process.env.DISCORD_LOGIN_GUILD_ID ??
    process.env.DISCORD_GUILD_ID ??
    MAIMAI_CHALLENGE_GUILD_ID;

  if (!discordUserId || !botToken || !guildId) {
    return false;
  }

  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${guildId}/members/${discordUserId}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 200) {
    return true;
  }

  if (response.status === 404) {
    return false;
  }

  throw new Error(`Discord guild member check failed: ${response.status}`);
}

function getDiscordUserId(user: User): string | null {
  const identity = user.identities?.find((item) => item.provider === "discord");
  const identityData = identity?.identity_data ?? {};

  return (
    readString(identityData, "id") ??
    readString(user.user_metadata, "provider_id") ??
    readString(user.user_metadata, "sub")
  );
}

function readString(source: object, key: string): string | null {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
