import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CHART_LIST_CACHE_TAG } from "@/lib/data/charts";
import { catalogPayloadSchema } from "@/lib/ingest/schema";
import {
  ingestMaimaiCatalogPayload,
  type IngestProgress,
} from "@/lib/ingest/service";
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
    const payload = catalogPayloadSchema.parse(json);
    const serviceClient = createSupabaseServiceClient();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        try {
          const result = await ingestMaimaiCatalogPayload(
            serviceClient,
            payload,
            (progress: IngestProgress) => send({ type: "progress", progress }),
          );

          revalidateTag(CHART_LIST_CACHE_TAG, "max");
          send({ type: "result", result });
        } catch (error) {
          send({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "곡 카탈로그 처리 중 오류가 발생했습니다.",
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
      error instanceof Error ? error.message : "곡 카탈로그 처리 중 오류가 발생했습니다.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
