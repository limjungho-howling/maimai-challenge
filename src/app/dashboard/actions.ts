"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kstNowIsoString } from "@/lib/time";

export async function updateDmAlerts(formData: FormData): Promise<void> {
  const enabled = formData.get("dmAlertsEnabled") === "on";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase
    .from("profiles")
    .update({
      dm_alerts_enabled: enabled,
      updated_at: kstNowIsoString(),
    })
    .eq("id", user.id);

  revalidatePath("/dashboard");
}

export async function updateRankDropMessageTitles(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const entries = [...formData.entries()]
    .filter(([key]) => key.startsWith("rankDropTitle:"))
    .map(([key, value]) => ({
      targetProfileId: key.replace("rankDropTitle:", ""),
      title: typeof value === "string" ? value.trim().slice(0, 120) : "",
    }));

  const upserts = entries
    .filter((entry) => entry.title)
    .map((entry) => ({
      actor_profile_id: user.id,
      target_profile_id: entry.targetProfileId,
      title: entry.title,
      updated_at: kstNowIsoString(),
    }));
  const deletes = entries
    .filter((entry) => !entry.title)
    .map((entry) => entry.targetProfileId);

  if (upserts.length > 0) {
    await supabase
      .from("rank_drop_message_titles")
      .upsert(upserts, { onConflict: "actor_profile_id,target_profile_id" });
  }

  if (deletes.length > 0) {
    await supabase
      .from("rank_drop_message_titles")
      .delete()
      .eq("actor_profile_id", user.id)
      .in("target_profile_id", deletes);
  }

  revalidatePath("/dashboard");
}
