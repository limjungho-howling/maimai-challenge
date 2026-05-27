import { NextResponse } from "next/server";

import { ingestPayloadSchema } from "@/lib/ingest/schema";
import { ingestMaimaiPayload } from "@/lib/ingest/service";
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
    const result = await ingestMaimaiPayload(serviceClient, user, payload);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "업로드 처리 중 오류가 발생했습니다.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
