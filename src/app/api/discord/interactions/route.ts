import { createPublicKey, verify } from "node:crypto";

import { NextResponse } from "next/server";

import { buildRankGoalMessage } from "@/lib/discord/messages";
import { fetchRankGoalsForDiscordUser } from "@/lib/discord/goals";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DISCORD_PING = 1;
const DISCORD_APPLICATION_COMMAND = 2;
const DISCORD_PONG_RESPONSE = 1;
const DISCORD_CHANNEL_MESSAGE_RESPONSE = 4;
const DISCORD_EPHEMERAL_FLAG = 64;

export async function POST(request: Request) {
  const body = await request.text();

  if (!verifyDiscordSignature(request, body)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as {
    type?: number;
    data?: { name?: string };
    member?: { user?: { id?: string } };
    user?: { id?: string };
  };

  if (interaction.type === DISCORD_PING) {
    return NextResponse.json({ type: DISCORD_PONG_RESPONSE });
  }

  if (interaction.type !== DISCORD_APPLICATION_COMMAND) {
    return commandResponse("지원하지 않는 Discord interaction입니다.");
  }

  const commandName = interaction.data?.name ?? "";
  if (!["goals", "goal", "목표"].includes(commandName)) {
    return commandResponse("지원하지 않는 명령어입니다. `/goals`를 사용해주세요.");
  }

  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordUserId) {
    return commandResponse("Discord 사용자 정보를 확인하지 못했습니다.");
  }

  const supabase = createSupabaseServiceClient();
  const { playerName, goals } = await fetchRankGoalsForDiscordUser(
    supabase,
    discordUserId,
    3,
  );

  return commandResponse(buildRankGoalMessage(playerName, goals));
}

function commandResponse(content: string) {
  return NextResponse.json({
    type: DISCORD_CHANNEL_MESSAGE_RESPONSE,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] },
    },
  });
}

function verifyDiscordSignature(request: Request, body: string): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!publicKey || !signature || !timestamp) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKey, "hex"),
      ]),
      format: "der",
      type: "spki",
    });

    return verify(
      null,
      Buffer.from(`${timestamp}${body}`),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
