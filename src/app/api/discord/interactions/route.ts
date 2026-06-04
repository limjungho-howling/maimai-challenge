import { createPublicKey, verify } from "node:crypto";

import { after } from "next/server";
import { NextResponse } from "next/server";

import {
  buildDailyChallengeMessage,
  buildRankGoalMessage,
  buildRecommendMessage,
  buildRivalChallengeMessage,
} from "@/lib/discord/messages";
import {
  DAILY_LEVEL_OPTIONS,
  fetchDailyChallengeGoals,
  fetchDailyChallengeUserOptions,
  fetchRankGoalsForDiscordUser,
  fetchRecommendedCharts,
  fetchRivalChallengeGoals,
} from "@/lib/discord/goals";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DISCORD_PING = 1;
const DISCORD_APPLICATION_COMMAND = 2;
const DISCORD_MESSAGE_COMPONENT = 3;
const DISCORD_PONG_RESPONSE = 1;
const DISCORD_CHANNEL_MESSAGE_RESPONSE = 4;
const DISCORD_DEFERRED_CHANNEL_MESSAGE_RESPONSE = 5;
const DISCORD_EPHEMERAL_FLAG = 64;
const DISCORD_SUPPRESS_EMBEDS_FLAG = 4;
const DISCORD_ACTION_ROW = 1;
const DISCORD_STRING_SELECT = 3;

export async function POST(request: Request) {
  const body = await request.text();

  if (!verifyDiscordSignature(request, body)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as {
    type?: number;
    data?: { name?: string; custom_id?: string; values?: string[] };
    application_id?: string;
    token?: string;
    member?: { user?: { id?: string } };
    user?: { id?: string };
  };

  if (interaction.type === DISCORD_PING) {
    return NextResponse.json({ type: DISCORD_PONG_RESPONSE });
  }

  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordUserId) {
    return commandResponse("Discord 사용자 정보를 확인하지 못했습니다.");
  }

  if (interaction.type === DISCORD_MESSAGE_COMPONENT) {
    return handleMessageComponent({
      data: interaction.data,
      discordUserId,
      applicationId: interaction.application_id,
      interactionToken: interaction.token,
    });
  }

  if (interaction.type !== DISCORD_APPLICATION_COMMAND) {
    return commandResponse("지원하지 않는 Discord interaction입니다.");
  }

  const commandName = interaction.data?.name ?? "";
  if (["daily", "데일리", "도전장"].includes(commandName)) {
    return dailyLevelPrompt();
  }

  if (["recommend", "추천"].includes(commandName)) {
    return recommendLevelPrompt();
  }

  if (["rival", "라이벌"].includes(commandName)) {
    return rivalLevelPrompt();
  }

  if (!["goals", "goal", "목표"].includes(commandName)) {
    return commandResponse("지원하지 않는 명령어입니다. `/goals`, `/daily`, `/recommend`, `/rival`을 사용해주세요.");
  }

  const supabase = createSupabaseServiceClient();
  const { playerName, goals } = await fetchRankGoalsForDiscordUser(
    supabase,
    discordUserId,
    3,
  );

  return commandResponse(buildRankGoalMessage(playerName, goals));
}

async function handleMessageComponent({
  data,
  discordUserId,
  applicationId,
  interactionToken,
}: {
  data: { custom_id?: string; values?: string[] } | undefined;
  discordUserId: string;
  applicationId?: string;
  interactionToken?: string;
}) {
  const customId = data?.custom_id ?? "";
  const value = data?.values?.[0] ?? "";

  if (customId === "daily_level") {
    const supabase = createSupabaseServiceClient();
    const userOptions = await fetchDailyChallengeUserOptions(supabase, discordUserId);
    return dailyUserPrompt(value, userOptions);
  }

  if (customId === "rival_level") {
    const supabase = createSupabaseServiceClient();
    const userOptions = await fetchDailyChallengeUserOptions(supabase, discordUserId);
    return rivalUserPrompt(
      value,
      userOptions.filter((option) => option.value !== "all"),
    );
  }

  if (customId === "recommend_level") {
    const supabase = createSupabaseServiceClient();
    const { playerName, recommendations } = await fetchRecommendedCharts({
      supabase,
      discordUserId,
      level: value,
      count: 3,
    });

    return commandResponse(
      buildRecommendMessage({
        playerName,
        levelLabel: getDailyLevelLabel(value),
        recommendations,
        appUrl: getAppUrl(),
      }),
    );
  }

  if (customId.startsWith("daily_user:")) {
    const level = decodeURIComponent(customId.slice("daily_user:".length));
    const targetProfileId = value || "all";

    if (!applicationId || !interactionToken) {
      return commandResponse("Discord interaction 후속 응답 정보를 확인하지 못했습니다.");
    }

    after(async () => {
      try {
        const supabase = createSupabaseServiceClient();
        const { playerName, targetLabel, goals } = await fetchDailyChallengeGoals({
          supabase,
          discordUserId,
          level,
          targetProfileId,
          count: 3,
        });
        const levelLabel = getDailyLevelLabel(level);

        await updateDeferredInteractionResponse({
          applicationId,
          interactionToken,
          content: buildDailyChallengeMessage({
            playerName,
            levelLabel,
            targetLabel,
            goals,
          }),
        });
      } catch (error) {
        await updateDeferredInteractionResponse({
          applicationId,
          interactionToken,
          content: `도전장 목표를 불러오는 중 오류가 발생했습니다: ${getErrorMessage(error)}`,
        });
      }
    });

    return deferredCommandResponse("도전장 목표를 찾는 중입니다.");
  }

  if (customId.startsWith("rival_user:")) {
    const level = decodeURIComponent(customId.slice("rival_user:".length));
    const targetProfileId = value;

    if (!applicationId || !interactionToken) {
      return commandResponse("Discord interaction 후속 응답 정보를 확인하지 못했습니다.");
    }

    after(async () => {
      try {
        const supabase = createSupabaseServiceClient();
        const { playerName, targetLabel, goals } = await fetchRivalChallengeGoals({
          supabase,
          discordUserId,
          level,
          targetProfileId,
          count: 3,
        });
        const levelLabel = getDailyLevelLabel(level);

        await updateDeferredInteractionResponse({
          applicationId,
          interactionToken,
          content: buildRivalChallengeMessage({
            playerName,
            levelLabel,
            targetLabel,
            goals,
          }),
        });
      } catch (error) {
        await updateDeferredInteractionResponse({
          applicationId,
          interactionToken,
          content: `라이벌 목표를 불러오는 중 오류가 발생했습니다: ${getErrorMessage(error)}`,
        });
      }
    });

    return deferredCommandResponse("라이벌 목표를 찾는 중입니다.");
  }

  return commandResponse("지원하지 않는 선택 메뉴입니다. `/daily`, `/recommend`, `/rival`을 다시 실행해주세요.");
}

function dailyLevelPrompt() {
  return commandResponse("어떤 레벨에 대해 도전장을 받으시겠습니까?", [
    {
      type: DISCORD_ACTION_ROW,
      components: [
        {
          type: DISCORD_STRING_SELECT,
          custom_id: "daily_level",
          placeholder: "레벨 선택",
          min_values: 1,
          max_values: 1,
          options: DAILY_LEVEL_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
  ]);
}

function dailyUserPrompt(
  level: string,
  userOptions: Array<{ label: string; value: string }>,
) {
  return commandResponse("어떤 유저에 대해 도전장을 받으시겠습니까?", [
    {
      type: DISCORD_ACTION_ROW,
      components: [
        {
          type: DISCORD_STRING_SELECT,
          custom_id: `daily_user:${encodeURIComponent(level)}`,
          placeholder: "유저 선택",
          min_values: 1,
          max_values: 1,
          options: userOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
  ]);
}

function recommendLevelPrompt() {
  return commandResponse("어떤 레벨의 곡을 추천받으시겠습니까?", [
    {
      type: DISCORD_ACTION_ROW,
      components: [
        {
          type: DISCORD_STRING_SELECT,
          custom_id: "recommend_level",
          placeholder: "추천 레벨 선택",
          min_values: 1,
          max_values: 1,
          options: DAILY_LEVEL_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
  ]);
}

function rivalLevelPrompt() {
  return commandResponse("어떤 레벨에 대해 라이벌 목표를 받으시겠습니까?", [
    {
      type: DISCORD_ACTION_ROW,
      components: [
        {
          type: DISCORD_STRING_SELECT,
          custom_id: "rival_level",
          placeholder: "레벨 선택",
          min_values: 1,
          max_values: 1,
          options: DAILY_LEVEL_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
  ]);
}

function rivalUserPrompt(
  level: string,
  userOptions: Array<{ label: string; value: string }>,
) {
  return commandResponse("어떤 유저를 목표로 삼으시겠습니까?", [
    {
      type: DISCORD_ACTION_ROW,
      components: [
        {
          type: DISCORD_STRING_SELECT,
          custom_id: `rival_user:${encodeURIComponent(level)}`,
          placeholder: "대상 유저 선택",
          min_values: 1,
          max_values: 1,
          options: userOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
  ]);
}

function commandResponse(content: string, components: unknown[] = []) {
  return NextResponse.json({
    type: DISCORD_CHANNEL_MESSAGE_RESPONSE,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_FLAG | DISCORD_SUPPRESS_EMBEDS_FLAG,
      allowed_mentions: { parse: [] },
      components,
    },
  });
}

function deferredCommandResponse(content: string) {
  return NextResponse.json({
    type: DISCORD_DEFERRED_CHANNEL_MESSAGE_RESPONSE,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_FLAG | DISCORD_SUPPRESS_EMBEDS_FLAG,
      allowed_mentions: { parse: [] },
    },
  });
}

async function updateDeferredInteractionResponse({
  applicationId,
  interactionToken,
  content,
}: {
  applicationId: string;
  interactionToken: string;
  content: string;
}) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        flags: DISCORD_EPHEMERAL_FLAG | DISCORD_SUPPRESS_EMBEDS_FLAG,
        allowed_mentions: { parse: [] },
        components: [],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Discord follow-up failed: ${response.status} ${await response.text()}`);
  }
}

function getDailyLevelLabel(level: string): string {
  return DAILY_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "https://maimai-challenge.vercel.app"
  );
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
