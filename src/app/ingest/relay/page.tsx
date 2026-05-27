import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RelayReceiver } from "@/components/relay-receiver";

export default async function IngestRelayPage() {
  let isLoggedIn = false;

  if (hasSupabasePublicEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#080b12,#111827_55%,#151620)] text-slate-100">
      <RelayReceiver isLoggedIn={isLoggedIn} />
    </main>
  );
}
