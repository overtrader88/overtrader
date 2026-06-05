import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { TelegramPairClient } from "@/components/telegram/pair-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Telegram · Trading IA",
};

export default async function TelegramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("telegram_links")
    .select("chat_id, username, paired_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const linked = link?.paired_at != null;

  return (
    <TelegramPairClient
      configured={isTelegramConfigured()}
      botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null}
      initialLinked={linked}
      initialUsername={link?.username ?? null}
    />
  );
}
