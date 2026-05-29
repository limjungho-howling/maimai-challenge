import { redirect } from "next/navigation";

import { isUserInAllowedDiscordGuild } from "@/lib/discord/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent("login_failed")}`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isAllowed = user
      ? await isUserInAllowedDiscordGuild(user).catch((error) => {
          console.error(error);
          return false;
        })
      : false;

    if (!isAllowed) {
      await supabase.auth.signOut();
      redirect(`/dashboard?error=${encodeURIComponent("discord_guild_required")}`);
    }
  }

  redirect(next);
}
