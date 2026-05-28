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
    .update({ dm_alerts_enabled: enabled, updated_at: kstNowIsoString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
}
