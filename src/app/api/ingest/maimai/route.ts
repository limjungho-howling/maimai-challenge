import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CHART_LIST_CACHE_TAG } from "@/lib/data/charts";
import { PLAYER_LEADERBOARD_CACHE_TAG } from "@/lib/data/players";
import { ingestPayloadSchema } from "@/lib/ingest/schema";
import { ingestMaimaiPayload, type IngestProgress } from "@/lib/ingest/service";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const json = await request.json();
    const payload = ingestPayloadSchema.parse(json);
    const serviceClient = createSupabaseServiceClient();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        try {
          const result = await ingestMaimaiPayload(
            serviceClient,
            user,
            payload,
            (progress: IngestProgress) => send({ type: "progress", progress }),
          );

          revalidateTag(CHART_LIST_CACHE_TAG, { expire: 0 });
          revalidateTag(PLAYER_LEADERBOARD_CACHE_TAG, { expire: 0 });
          revalidatePath("/players");
          send({ type: "result", result });
        } catch (error) {
          send({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "업로드 처리 중 오류가 발생했습니다.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "업로드 처리 중 오류가 발생했습니다.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
