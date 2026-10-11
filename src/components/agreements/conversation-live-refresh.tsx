"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ConversationLiveRefresh({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const channel = supabase.channel(`agreement-conversation:${agreementId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agreement_messages", filter: `agreement_id=eq.${agreementId}` }, refresh)
      .subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh(); });
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); void supabase.removeChannel(channel); };
  }, [agreementId, router]);
  return null;
}
